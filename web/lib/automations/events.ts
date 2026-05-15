import {
  AUTOMATION_EVENT_SOURCE,
  type AutomationEventName,
  type AutomationEventPayload,
  type AutomationSendResult,
  type EmitConversationCreatedEventInput,
} from "./types";
import { sendAutomationEvent } from "./client";

export type CreateAutomationEventParams = {
  event: AutomationEventName;
  data: Record<string, unknown>;
};

/**
 * Construye el payload de un evento de automatización (sin secretos ni historial).
 */
export function createAutomationEvent(
  params: CreateAutomationEventParams,
): AutomationEventPayload {
  return {
    event: params.event,
    occurred_at: new Date().toISOString(),
    source: AUTOMATION_EVENT_SOURCE,
    data: params.data,
  };
}

/**
 * Emite `conversation.created` hacia n8n (solo servidor). No registra payload completo.
 * Devuelve el mismo resultado que `sendAutomationEvent` (no lanza por fallos de red/HTTP).
 */
export async function emitConversationCreatedEvent(
  input: EmitConversationCreatedEventInput,
): Promise<AutomationSendResult> {
  const payload = createAutomationEvent({
    event: "conversation.created",
    data: {
      conversation_id: input.conversation_id,
      created_at: input.created_at,
      title: input.title ?? null,
      origin: input.origin ?? "chat",
    },
  });
  return sendAutomationEvent(payload);
}
