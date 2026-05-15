import { NextResponse } from "next/server";
import { handleChatTurn } from "@/lib/chat/chat-engine";
import { chatTurnErrorMessages } from "@/lib/chat/types";
import {
  CONTEXT_MESSAGE_LIMIT,
  createConversation,
  getConversation,
  getConversationSummary,
  getRecentMessagesForContext,
  saveMessage,
} from "@/lib/chat/persistence";
import { validateChatTurnBody } from "@/lib/chat/validate-input";
import { updateConversationSummaryIfNeeded } from "@/lib/chat/summary";
import { generateConversationTitleIfNeeded } from "@/lib/chat/title";
import { emitConversationCreatedEvent } from "@/lib/automations/events";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: chatTurnErrorMessages.invalidJsonBody },
      { status: 400 },
    );
  }

  const validation = validateChatTurnBody(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { content, conversation_id: requestedConversationId } =
    validation.input;

  let conversationId: string;
  let wasConversationCreated = false;
  let newConversationCreatedAt: string | undefined;
  let newConversationTitle: string | null | undefined;

  if (requestedConversationId) {
    const existing = await getConversation({
      conversation_id: requestedConversationId,
    });
    if (!existing.ok) {
      if (existing.error === "not_found") {
        return NextResponse.json(
          { error: chatTurnErrorMessages.conversationNotFound },
          { status: 404 },
        );
      }
      return NextResponse.json(
        { error: chatTurnErrorMessages.failedToVerifyConversation },
        { status: 500 },
      );
    }
    conversationId = existing.data.id;
  } else {
    const created = await createConversation();
    if (!created.ok) {
      return NextResponse.json(
        { error: chatTurnErrorMessages.failedToCreateConversation },
        { status: 500 },
      );
    }
    conversationId = created.data.id;
    wasConversationCreated = true;
    newConversationCreatedAt = created.data.created_at;
    newConversationTitle = created.data.title;
  }

  const userPersisted = await saveMessage({
    conversation_id: conversationId,
    role: "user",
    content,
  });
  if (!userPersisted.ok) {
    return NextResponse.json(
      { error: chatTurnErrorMessages.failedToSaveUserMessage },
      { status: 500 },
    );
  }

  const automation_update: {
    conversation_created: { attempted: boolean; sent: boolean };
  } = {
    conversation_created: { attempted: false, sent: false },
  };

  if (wasConversationCreated) {
    automation_update.conversation_created.attempted = true;
    try {
      const emitResult = await emitConversationCreatedEvent({
        conversation_id: conversationId,
        created_at:
          newConversationCreatedAt ?? new Date().toISOString(),
        title: newConversationTitle ?? null,
        origin: "chat",
      });
      automation_update.conversation_created.sent = emitResult.ok;
    } catch {
      automation_update.conversation_created.sent = false;
    }
  }

  const contextLoaded = await getRecentMessagesForContext({
    conversation_id: conversationId,
    limit: CONTEXT_MESSAGE_LIMIT,
  });
  if (!contextLoaded.ok) {
    return NextResponse.json(
      { error: chatTurnErrorMessages.failedToLoadContext },
      { status: 500 },
    );
  }

  let conversation_summary: string | undefined;
  try {
    const summaryLoaded = await getConversationSummary({
      conversation_id: conversationId,
    });
    if (summaryLoaded.ok) {
      const text = summaryLoaded.data?.summary?.trim();
      if (text) {
        conversation_summary = text;
      }
    } else {
      console.warn("chat/turn: could not load conversation summary");
    }
  } catch {
    console.warn("chat/turn: unexpected error loading conversation summary");
  }

  const turn = await handleChatTurn({
    content,
    conversation_id: conversationId,
    context_messages: contextLoaded.data,
    ...(conversation_summary ? { conversation_summary } : {}),
  });

  const assistantPersisted = await saveMessage({
    conversation_id: conversationId,
    role: "assistant",
    content: turn.reply,
  });
  if (!assistantPersisted.ok) {
    return NextResponse.json(
      { error: chatTurnErrorMessages.failedToSaveAssistantMessage },
      { status: 500 },
    );
  }

  let title_update: { attempted: true; updated: boolean };
  try {
    const titleResult = await generateConversationTitleIfNeeded({
      conversation_id: conversationId,
    });
    title_update = {
      attempted: true,
      updated: titleResult.updated === true,
    };
  } catch {
    title_update = { attempted: true, updated: false };
  }

  let summary_update: { attempted: true; updated: boolean };
  try {
    const summaryResult = await updateConversationSummaryIfNeeded({
      conversation_id: conversationId,
    });
    summary_update = {
      attempted: true,
      updated: summaryResult.updated === true,
    };
  } catch {
    summary_update = { attempted: true, updated: false };
  }

  return NextResponse.json({
    reply: turn.reply,
    conversation_id: conversationId,
    title_update,
    summary_update,
    automation_update,
  });
}
