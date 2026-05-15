import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({
      ok: false,
      error: "Supabase is not configured",
    });
  }

  const [conversationsResult, messagesResult, conversationSummariesResult] =
    await Promise.all([
      supabase.from("conversations").select("id").limit(1),
      supabase.from("messages").select("id").limit(1),
      supabase
        .from("conversation_summaries")
        .select("conversation_id")
        .limit(1),
    ]);

  const conversations_accessible = conversationsResult.error === null;
  const messages_accessible = messagesResult.error === null;
  const conversation_summaries_accessible =
    conversationSummariesResult.error === null;
  const ok =
    conversations_accessible &&
    messages_accessible &&
    conversation_summaries_accessible;

  if (ok) {
    return NextResponse.json({
      ok: true,
      conversations_accessible: true,
      messages_accessible: true,
      conversation_summaries_accessible: true,
    });
  }

  return NextResponse.json({
    ok: false,
    conversations_accessible,
    messages_accessible,
    conversation_summaries_accessible,
  });
}
