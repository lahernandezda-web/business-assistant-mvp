/** Mensajes de error expuestos por `POST /api/chat/turn` (contrato estable). */
export const chatTurnErrorMessages = {
  invalidJsonBody: "Invalid JSON body",
  contentRequired: "content is required",
  contentMustBeString: "content must be a string",
  contentCannotBeEmpty: "content cannot be empty",
  conversationIdMustBeString: "conversation_id must be a string",
  conversationNotFound: "conversation not found",
  failedToCreateConversation: "failed to create conversation",
  failedToSaveUserMessage: "failed to save user message",
  failedToSaveAssistantMessage: "failed to save assistant message",
  failedToVerifyConversation: "failed to verify conversation",
  failedToLoadContext: "failed to load conversation context",
} as const;

/**
 * Mensaje mínimo de contexto conversacional enviado a Claude.
 * Solo `role` + `content`: sin ids, sin timestamps, sin metadata.
 */
export type ChatContextMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatTurnInput = {
  content: string;
  conversation_id?: string | null;
  context_messages?: ChatContextMessage[];
  /** Texto del resumen acumulado en BD; opcional, solo contexto para el modelo. */
  conversation_summary?: string;
};

export type ChatTurnResult = {
  reply: string;
  conversation_id: string | null;
};

/** Códigos internos opcionales para logs o evolución; la API usa siempre `error: string`. */
export type ChatTurnErrorCode =
  | "CONTENT_REQUIRED"
  | "CONTENT_NOT_STRING"
  | "CONTENT_EMPTY"
  | "CONVERSATION_ID_NOT_STRING";

export type ChatTurnValidationSuccess = {
  ok: true;
  input: ChatTurnInput;
};

export type ChatTurnValidationFailure = {
  ok: false;
  error: string;
  /** Opcional: categoría estable sin romper el contrato JSON actual. */
  code?: ChatTurnErrorCode;
};

export type ChatTurnValidationResult =
  | ChatTurnValidationSuccess
  | ChatTurnValidationFailure;
