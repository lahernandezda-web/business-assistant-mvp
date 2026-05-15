import {
  chatTurnErrorMessages,
  type ChatTurnInput,
  type ChatTurnValidationResult,
} from "./types";

/**
 * Valida y normaliza el body ya parseado de `POST /api/chat/turn`.
 * El JSON inválido se maneja en el Route Handler (antes de llamar aquí).
 */
export function validateChatTurnBody(body: unknown): ChatTurnValidationResult {
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      ok: false,
      error: chatTurnErrorMessages.contentRequired,
      code: "CONTENT_REQUIRED",
    };
  }

  const record = body as Record<string, unknown>;
  if (!("content" in record)) {
    return {
      ok: false,
      error: chatTurnErrorMessages.contentRequired,
      code: "CONTENT_REQUIRED",
    };
  }

  const raw = record.content;
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: chatTurnErrorMessages.contentMustBeString,
      code: "CONTENT_NOT_STRING",
    };
  }

  const content = raw.trim();
  if (content === "") {
    return {
      ok: false,
      error: chatTurnErrorMessages.contentCannotBeEmpty,
      code: "CONTENT_EMPTY",
    };
  }

  let conversation_id: string | undefined;
  if ("conversation_id" in record) {
    const cid = record.conversation_id;
    if (cid === null || cid === undefined) {
      // ausente: no añadimos conversation_id al input
    } else if (typeof cid !== "string") {
      return {
        ok: false,
        error: chatTurnErrorMessages.conversationIdMustBeString,
        code: "CONVERSATION_ID_NOT_STRING",
      };
    } else {
      const trimmed = cid.trim();
      if (trimmed !== "") {
        conversation_id = trimmed;
      }
    }
  }

  const input: ChatTurnInput = { content };
  if (conversation_id !== undefined) {
    input.conversation_id = conversation_id;
  }

  return { ok: true, input };
}
