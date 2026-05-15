import { NextResponse } from "next/server";
import { getMessagesForConversation } from "@/lib/chat/persistence";

function conversationIdFromSearchParams(raw: string | null): string | null {
  if (raw === null || typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Parsea `limit` de query. Valores no enteros o no finitos se tratan como ausentes
 * (la capa de persistencia aplicará el default 50).
 */
function parseLimitSearchParam(value: string | null): number | undefined {
  if (value === null || value.trim() === "") {
    return undefined;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return undefined;
  }
  return n;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const conversation_id = conversationIdFromSearchParams(
    searchParams.get("conversation_id"),
  );
  if (!conversation_id) {
    return NextResponse.json(
      { error: "conversation_id missing" },
      { status: 400 },
    );
  }

  const limit = parseLimitSearchParam(searchParams.get("limit"));

  const result = await getMessagesForConversation({
    conversation_id,
    ...(limit !== undefined ? { limit } : {}),
  });

  if (!result.ok) {
    if (result.error === "not_found") {
      return NextResponse.json(
        { error: "conversation not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "failed to load messages" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    conversation_id,
    messages: result.data,
  });
}
