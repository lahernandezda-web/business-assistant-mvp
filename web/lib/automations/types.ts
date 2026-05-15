export type AutomationEventName =
  | "test.automation"
  | "conversation.created"
  | "message.created"
  | "conversation.title_generated"
  | "conversation.summary_updated"
  | "lead.detected"
  | "human_followup_requested";

export const AUTOMATION_EVENT_SOURCE = "cursor-ai-building-system" as const;

export type AutomationEventPayload = {
  event: AutomationEventName;
  occurred_at: string;
  source: typeof AUTOMATION_EVENT_SOURCE;
  data: Record<string, unknown>;
};

export type AutomationSendError =
  | "disabled"
  | "not_configured"
  | "timeout"
  | "network_error"
  | "bad_status";

export type AutomationSendResult =
  | { ok: true; status: number }
  | { ok: false; error: AutomationSendError; status?: number };

/** Entrada para emitir `conversation.created` (sin mensajes ni summary). */
export type EmitConversationCreatedEventInput = {
  conversation_id: string;
  created_at: string;
  title?: string | null;
  origin?: "chat";
};

/** Respuesta de `GET /api/automations/status` (solo booleanos; sin secretos ni URL). */
export type AutomationServerStatusPayload = {
  enabled: boolean;
  has_webhook_url: boolean;
  has_webhook_secret: boolean;
  configured: boolean;
};
