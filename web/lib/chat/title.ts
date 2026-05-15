import { getAIProvider } from "@/lib/ai/get-provider";
import type { PersistenceErrorCode } from "./persistence";
import {
  countMessagesForConversation,
  getConversationTitleState,
  getMessagesForTitleGeneration,
  updateConversationTitle,
} from "./persistence";

/** Mensajes totales mínimos antes de intentar generar título (spec MVP). */
export const TITLE_TRIGGER_MESSAGE_COUNT = 4;

/** Cuántos primeros mensajes cronológicos se envían al modelo para el título. */
export const TITLE_CONTEXT_MESSAGE_LIMIT = 4;

const MAX_NORMALIZED_TITLE_LENGTH = 80;

export type ShouldGenerateConversationTitleInput = {
  title: string | null;
  total_messages: number;
};

export type BuildConversationTitlePromptInput = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export type ConversationTitleUpdateResult =
  | { updated: true; title: string }
  | { updated: false; reason: "not_needed" }
  | { updated: false; error: PersistenceErrorCode | "ai_error" };

export type GenerateConversationTitleIfNeededInput = {
  conversation_id: string;
};

/**
 * Indica si conviene intentar generar título: sin título aún y umbral de mensajes.
 */
export function shouldGenerateConversationTitle(
  input: ShouldGenerateConversationTitleInput,
): boolean {
  if (input.title != null && input.title.trim() !== "") {
    return false;
  }
  const total = Number.isFinite(input.total_messages)
    ? Math.max(0, Math.floor(input.total_messages))
    : 0;
  if (total < TITLE_TRIGGER_MESSAGE_COUNT) {
    return false;
  }
  return true;
}

/**
 * Prompt compacto para pedir un título corto fiel al hilo (sin IDs ni timestamps).
 */
export function buildConversationTitlePrompt(
  input: BuildConversationTitlePromptInput,
): string {
  const lines = input.messages.map((m, i) => {
    const label = m.role === "user" ? "Usuario" : "Asistente";
    return `${i + 1}. [${label}]\n${m.content}`;
  });

  return [
    "Tarea: proponer un título breve para esta conversación.",
    "",
    "Requisitos del título:",
    "- Máximo 5 a 7 palabras.",
    "- Idioma: el mismo que el de la conversación (sigue el idioma de los mensajes).",
    "- Sin comillas alrededor del título.",
    "- Sin punto final.",
    "- Describe solo el tema principal; no inventes información que no aparezca en los mensajes.",
    "- No incluyas datos sensibles innecesarios (contraseñas, tokens, números completos de documento, etc.).",
    "- Responde únicamente con el texto del título, sin explicación ni saludo.",
    "",
    "Mensajes iniciales:",
    lines.join("\n\n"),
  ].join("\n");
}

/**
 * Limpia la salida del modelo para persistencia. Devuelve null si no queda texto útil.
 */
export function normalizeGeneratedTitle(title: string): string | null {
  let t = title.trim();
  if (t === "") {
    return null;
  }
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  if (t === "") {
    return null;
  }
  if (t.endsWith(".")) {
    t = t.slice(0, -1).trim();
  }
  if (t === "") {
    return null;
  }
  if (t.length > MAX_NORMALIZED_TITLE_LENGTH) {
    t = t.slice(0, MAX_NORMALIZED_TITLE_LENGTH).trimEnd();
  }
  return t === "" ? null : t;
}

/**
 * Si la conversación aún no tiene título y hay contexto suficiente, genera título
 * con el proveedor IA y lo guarda. No registra contenido de mensajes ni de la respuesta.
 */
export async function generateConversationTitleIfNeeded(
  input: GenerateConversationTitleIfNeededInput,
): Promise<ConversationTitleUpdateResult> {
  const titleStateResult = await getConversationTitleState({
    conversation_id: input.conversation_id,
  });
  if (!titleStateResult.ok) {
    return { updated: false, error: titleStateResult.error };
  }

  const countResult = await countMessagesForConversation({
    conversation_id: input.conversation_id,
  });
  if (!countResult.ok) {
    return { updated: false, error: countResult.error };
  }

  const total_messages = countResult.data;

  if (
    !shouldGenerateConversationTitle({
      title: titleStateResult.data.title,
      total_messages,
    })
  ) {
    return { updated: false, reason: "not_needed" };
  }

  const messagesResult = await getMessagesForTitleGeneration({
    conversation_id: input.conversation_id,
    limit: TITLE_CONTEXT_MESSAGE_LIMIT,
  });
  if (!messagesResult.ok) {
    return { updated: false, error: messagesResult.error };
  }

  const promptMessages = messagesResult.data
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  if (promptMessages.length === 0) {
    return { updated: false, reason: "not_needed" };
  }

  const userPrompt = buildConversationTitlePrompt({
    messages: promptMessages,
  });

  let aiText: string;
  try {
    const provider = getAIProvider();
    const aiResult = await provider.complete({
      messages: [{ role: "user", content: userPrompt }],
    });
    aiText = aiResult.content.trim();
  } catch {
    return { updated: false, error: "ai_error" };
  }

  const normalized = normalizeGeneratedTitle(aiText);
  if (normalized === null) {
    return { updated: false, error: "ai_error" };
  }

  const saveResult = await updateConversationTitle({
    conversation_id: input.conversation_id,
    title: normalized,
  });
  if (!saveResult.ok) {
    return { updated: false, error: saveResult.error };
  }

  return { updated: true, title: saveResult.data.title };
}
