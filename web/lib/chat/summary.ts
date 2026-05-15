import { getAIProvider } from "@/lib/ai/get-provider";
import type { PersistenceErrorCode } from "./persistence";
import {
  countMessagesForConversation,
  getConversationSummary,
  getMessagesForSummaryBatch,
  upsertConversationSummary,
} from "./persistence";

/** Mensajes nuevos desde el último summary antes de considerar un ciclo de actualización. */
export const SUMMARY_TRIGGER_MESSAGE_COUNT = 12;

/** Cuántos mensajes del hilo se incluyen por ciclo de resumen (orden cronológico). */
export const SUMMARY_BATCH_SIZE = 8;

export type ShouldUpdateConversationSummaryInput = {
  total_messages: number;
  messages_summarized_count: number;
};

export type BuildSummaryPromptInput = {
  previous_summary: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export type SummaryUpdateResult =
  | { updated: true; messages_summarized_count: number }
  | {
      updated: false;
      reason: "not_needed" | "insufficient_batch";
    }
  | { updated: false; error: PersistenceErrorCode | "ai_error" };

/**
 * Decide si el delta entre el total de mensajes y lo ya cubierto por el summary
 * alcanza el umbral para un nuevo ciclo de resumen.
 */
export function shouldUpdateConversationSummary(
  input: ShouldUpdateConversationSummaryInput,
): boolean {
  const total = Number.isFinite(input.total_messages)
    ? Math.max(0, Math.floor(input.total_messages))
    : 0;
  const summarized = Number.isFinite(input.messages_summarized_count)
    ? Math.max(0, Math.floor(input.messages_summarized_count))
    : 0;
  const pending_messages = total - summarized;
  if (!Number.isFinite(pending_messages)) {
    return false;
  }
  return pending_messages >= SUMMARY_TRIGGER_MESSAGE_COUNT;
}

/**
 * Texto de instrucciones + contexto para pedir al modelo un resumen acumulativo breve.
 * No incluye IDs ni timestamps; solo roles y contenido del lote.
 */
export function buildSummaryPrompt(input: BuildSummaryPromptInput): string {
  const previous =
    input.previous_summary.trim().length > 0
      ? input.previous_summary.trim()
      : "(No hay resumen previo; genera uno nuevo a partir del lote.)";

  const lines = input.messages.map((m, i) => {
    const label = m.role === "user" ? "Usuario" : "Asistente";
    return `${i + 1}. [${label}]\n${m.content}`;
  });

  return [
    "Tarea: actualizar un resumen acumulativo de la conversación.",
    "",
    "Requisitos:",
    "- Responde solo con el texto del resumen, sin saludo ni prefacio.",
    "- Español si el hilo está en español; si está en otro idioma, sigue ese idioma.",
    "- Breve, denso y fiel a lo conversado: decisiones, requisitos, restricciones y datos importantes.",
    "- Acumulativo: fusiona lo útil del resumen previo con lo nuevo del lote; no repitas cortesías ni ruido.",
    "- No inventes información ni añadas opiniones nuevas.",
    "- Omite datos sensibles que no sean necesarios para continuar el hilo.",
    "- Útil para que un modelo continúe con menos contexto completo.",
    "",
    "Resumen previo:",
    previous,
    "",
    "Nuevos mensajes a incorporar:",
    lines.join("\n\n"),
  ].join("\n");
}

/**
 * Evalúa y, si corresponde, genera y persiste un summary acumulado para la conversación.
 * No registra contenido de mensajes ni respuestas del modelo.
 */
export async function updateConversationSummaryIfNeeded(input: {
  conversation_id: string;
}): Promise<SummaryUpdateResult> {
  const countResult = await countMessagesForConversation({
    conversation_id: input.conversation_id,
  });
  if (!countResult.ok) {
    return { updated: false, error: countResult.error };
  }

  const total_messages = countResult.data;

  const summaryRowResult = await getConversationSummary({
    conversation_id: input.conversation_id,
  });
  if (!summaryRowResult.ok) {
    return { updated: false, error: summaryRowResult.error };
  }

  const existing = summaryRowResult.data;
  const messages_summarized_count = existing?.messages_summarized_count ?? 0;
  const previous_summary = existing?.summary ?? "";

  if (
    !shouldUpdateConversationSummary({
      total_messages,
      messages_summarized_count,
    })
  ) {
    return { updated: false, reason: "not_needed" };
  }

  const batchResult = await getMessagesForSummaryBatch({
    conversation_id: input.conversation_id,
    offset: messages_summarized_count,
    limit: SUMMARY_BATCH_SIZE,
  });
  if (!batchResult.ok) {
    return { updated: false, error: batchResult.error };
  }

  const batch = batchResult.data;
  if (batch.length === 0) {
    return { updated: false, reason: "not_needed" };
  }

  const promptMessages = batch
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  if (promptMessages.length === 0) {
    return { updated: false, reason: "insufficient_batch" };
  }

  const userPrompt = buildSummaryPrompt({
    previous_summary,
    messages: promptMessages,
  });

  const provider = getAIProvider();
  const aiResult = await provider.complete({
    messages: [{ role: "user", content: userPrompt }],
  });

  const newSummaryText = aiResult.content.trim();
  if (!newSummaryText) {
    return { updated: false, error: "ai_error" };
  }

  const lastMessage = batch[batch.length - 1];
  const newMessagesSummarizedCount =
    messages_summarized_count + batch.length;

  const upsertResult = await upsertConversationSummary({
    conversation_id: input.conversation_id,
    summary: newSummaryText,
    last_message_id: lastMessage.id,
    messages_summarized_count: newMessagesSummarizedCount,
    metadata: existing?.metadata ?? {},
  });

  if (!upsertResult.ok) {
    return { updated: false, error: upsertResult.error };
  }

  return {
    updated: true,
    messages_summarized_count: newMessagesSummarizedCount,
  };
}
