import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChatContextMessage } from "./types";

/**
 * Capa interna de persistencia del chat (Supabase, server-side).
 *
 * Reglas:
 * - Solo se usa desde servidor (API routes / server actions).
 * - Usa siempre `createSupabaseServerClient()` (service role) — nunca desde el navegador.
 * - No expone errores crudos de Supabase ni claves; los errores se devuelven
 *   como códigos cortos (`not_configured`, `db_error`, `not_found`, `invalid_input`).
 * - Consumida desde `POST /api/chat/turn`, `GET /api/chat/history` y
 *   `GET /api/chat/conversations`.
 * - Funciones de `conversation_summaries` (Conversation Summary MVP): lectura
 *   por conversación, upsert y lotes de mensajes para futura generación de
 *   resúmenes (sin llamadas a Claude desde esta capa).
 * - `conversations.title` y mensajes iniciales para generación de título (sin Claude).
 */

export type MessageRole = "user" | "assistant" | "system";

export type PersistenceErrorCode =
  | "not_configured"
  | "db_error"
  | "not_found"
  | "invalid_input";

export type PersistenceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: PersistenceErrorCode };

export type ConversationRef = {
  id: string;
  /** Presente cuando la fila se obtiene al crear la conversación. */
  created_at?: string;
  title?: string | null;
};

export type SavedMessage = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
};

export type SaveMessageInput = {
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
};

export type GetConversationInput = {
  conversation_id: string;
};

const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 100;

const DEFAULT_RECENT_CONVERSATIONS_LIMIT = 20;
const MAX_RECENT_CONVERSATIONS_LIMIT = 50;

/** Longitud máxima del texto mostrado en la lista de conversaciones recientes. */
const CONVERSATION_LIST_PREVIEW_MAX_LENGTH = 120;

/**
 * Normaliza el contenido de un mensaje para preview en listas: sin metadata,
 * sin llamadas a IA; solo texto recortado y espacios colapsados.
 */
function buildLastMessagePreview(
  content: string | null | undefined,
): string | null {
  if (content == null || typeof content !== "string") {
    return null;
  }
  const collapsed = content.trim().replace(/\s+/g, " ");
  if (collapsed === "") {
    return null;
  }
  if (collapsed.length <= CONVERSATION_LIST_PREVIEW_MAX_LENGTH) {
    return collapsed;
  }
  return (
    collapsed.slice(0, CONVERSATION_LIST_PREVIEW_MAX_LENGTH - 1).trimEnd() +
    "…"
  );
}

const DEFAULT_SUMMARY_BATCH_LIMIT = 50;
const MAX_SUMMARY_BATCH_LIMIT = 100;
const MAX_SUMMARY_BATCH_OFFSET = 1_000_000;

/**
 * Tope duro de mensajes recientes que se envían como contexto a Claude
 * en el MVP de Conversation Context. Solo `role` + `content`, sin metadata.
 */
export const CONTEXT_MESSAGE_LIMIT = 6;

const DEFAULT_TITLE_GENERATION_LIMIT = 4;
const MAX_TITLE_GENERATION_LIMIT = 8;

/** Longitud máxima persistida para `conversations.title` (MVP títulos automáticos). */
const MAX_CONVERSATION_TITLE_LENGTH = 80;

export type GetMessagesForConversationInput = {
  conversation_id: string;
  limit?: number;
};

export type GetRecentMessagesForContextInput = {
  conversation_id: string;
  limit?: number;
};

export type ConversationMessageRow = {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
};

/** Fila de `conversation_summaries` (MVP summaries, server-side). */
export type ConversationSummaryRecord = {
  conversation_id: string;
  summary: string;
  last_message_id: string | null;
  messages_summarized_count: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
};

export type GetConversationSummaryInput = {
  conversation_id: string;
};

export type UpsertConversationSummaryInput = {
  conversation_id: string;
  summary: string;
  last_message_id: string | null;
  messages_summarized_count: number;
  metadata?: Record<string, unknown>;
};

/** Mensaje mínimo para lotes de resumen (orden ascendente por `created_at`). */
export type SummaryBatchMessage = {
  id: string;
  role: MessageRole;
  content: string;
  created_at: string;
};

export type GetMessagesForSummaryBatchInput = {
  conversation_id: string;
  offset?: number;
  limit?: number;
};

export type CountMessagesForConversationInput = {
  conversation_id: string;
};

function resolveMessageLimit(limit?: number): number {
  if (limit === undefined || limit === null) {
    return DEFAULT_MESSAGE_LIMIT;
  }
  if (!Number.isFinite(limit) || !Number.isInteger(limit)) {
    return DEFAULT_MESSAGE_LIMIT;
  }
  if (limit > MAX_MESSAGE_LIMIT) {
    return MAX_MESSAGE_LIMIT;
  }
  if (limit < DEFAULT_MESSAGE_LIMIT) {
    return DEFAULT_MESSAGE_LIMIT;
  }
  return limit;
}

export type GetRecentConversationsInput = {
  limit?: number;
};

export type RecentConversationRow = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_preview: string | null;
};

/** Estado mínimo de `conversations.title` para generación automática (MVP títulos). */
export type ConversationTitleState = {
  id: string;
  title: string | null;
};

export type GetConversationTitleStateInput = {
  conversation_id: string;
};

export type UpdateConversationTitleInput = {
  conversation_id: string;
  title: string;
};

/** Fila tras actualizar `conversations.title` (solo id + title). */
export type UpdatedConversationTitle = {
  id: string;
  title: string;
};

/** Primeros mensajes `user`/`assistant` para prompt de título; sin `metadata`. */
export type TitleGenerationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type GetMessagesForTitleGenerationInput = {
  conversation_id: string;
  limit?: number;
};

function resolveContextLimit(limit?: number): number {
  if (
    limit === undefined ||
    limit === null ||
    !Number.isFinite(limit) ||
    !Number.isInteger(limit) ||
    limit < 1
  ) {
    return CONTEXT_MESSAGE_LIMIT;
  }
  if (limit > CONTEXT_MESSAGE_LIMIT) {
    return CONTEXT_MESSAGE_LIMIT;
  }
  return limit;
}

function resolveRecentConversationsLimit(limit?: number): number {
  if (limit === undefined || limit === null) {
    return DEFAULT_RECENT_CONVERSATIONS_LIMIT;
  }
  if (!Number.isFinite(limit) || !Number.isInteger(limit)) {
    return DEFAULT_RECENT_CONVERSATIONS_LIMIT;
  }
  if (limit < 1) {
    return DEFAULT_RECENT_CONVERSATIONS_LIMIT;
  }
  if (limit > MAX_RECENT_CONVERSATIONS_LIMIT) {
    return MAX_RECENT_CONVERSATIONS_LIMIT;
  }
  return limit;
}

function resolveTitleGenerationLimit(limit?: number): number {
  if (
    limit === undefined ||
    limit === null ||
    !Number.isFinite(limit) ||
    !Number.isInteger(limit) ||
    limit < 1
  ) {
    return DEFAULT_TITLE_GENERATION_LIMIT;
  }
  if (limit > MAX_TITLE_GENERATION_LIMIT) {
    return MAX_TITLE_GENERATION_LIMIT;
  }
  return limit;
}

/**
 * Normaliza texto de título antes de persistir: trim y tope de caracteres.
 * No comprueba vacío; el llamador debe validar.
 */
function sanitizeConversationTitleForPersistence(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length <= MAX_CONVERSATION_TITLE_LENGTH) {
    return trimmed;
  }
  return trimmed.slice(0, MAX_CONVERSATION_TITLE_LENGTH).trimEnd();
}

function resolveSummaryBatchOffset(offset?: number): number {
  if (
    offset === undefined ||
    offset === null ||
    !Number.isFinite(offset) ||
    !Number.isInteger(offset) ||
    offset < 0
  ) {
    return 0;
  }
  if (offset > MAX_SUMMARY_BATCH_OFFSET) {
    return MAX_SUMMARY_BATCH_OFFSET;
  }
  return offset;
}

function resolveSummaryBatchLimit(limit?: number): number {
  if (
    limit === undefined ||
    limit === null ||
    !Number.isFinite(limit) ||
    !Number.isInteger(limit) ||
    limit < 1
  ) {
    return DEFAULT_SUMMARY_BATCH_LIMIT;
  }
  if (limit > MAX_SUMMARY_BATCH_LIMIT) {
    return MAX_SUMMARY_BATCH_LIMIT;
  }
  return limit;
}

function mapSummaryRow(
  row: Record<string, unknown>,
): ConversationSummaryRecord {
  const metadata = row.metadata;
  return {
    conversation_id: row.conversation_id as string,
    summary: row.summary as string,
    last_message_id:
      row.last_message_id === null || row.last_message_id === undefined
        ? null
        : (row.last_message_id as string),
    messages_summarized_count: Number(row.messages_summarized_count),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    metadata:
      metadata !== null &&
      typeof metadata === "object" &&
      !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {},
  };
}

/**
 * Crea una nueva fila en `conversations`.
 * Devuelve `id`, `created_at` y `title` en caso de éxito (título suele ser `null` al crear).
 */
export async function createConversation(): Promise<
  PersistenceResult<ConversationRef>
> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({})
    .select("id, created_at, title")
    .single();

  if (error || !data?.id) {
    return { ok: false, error: "db_error" };
  }

  return {
    ok: true,
    data: {
      id: data.id as string,
      created_at:
        typeof data.created_at === "string" ? data.created_at : undefined,
      title:
        data.title === null || data.title === undefined
          ? null
          : (data.title as string),
    },
  };
}

/**
 * Comprueba que una conversación existe por id.
 * Devuelve `{ id }` si existe, `not_found` si no, o `db_error` ante un error real de Supabase.
 */
export async function getConversation(
  input: GetConversationInput,
): Promise<PersistenceResult<ConversationRef>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", input.conversation_id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "db_error" };
  }
  if (!data?.id) {
    return { ok: false, error: "not_found" };
  }

  return { ok: true, data: { id: data.id as string } };
}

/**
 * Inserta una fila en `messages`. El `conversation_id` debe existir previamente
 * (la FK con `on delete cascade` y el check de roles los aplica el esquema SQL).
 */
export async function saveMessage(
  input: SaveMessageInput,
): Promise<PersistenceResult<SavedMessage>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const row = {
    conversation_id: input.conversation_id,
    role: input.role,
    content: input.content,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };

  const { data, error } = await supabase
    .from("messages")
    .insert(row)
    .select("id, conversation_id, role, content")
    .single();

  if (error || !data) {
    return { ok: false, error: "db_error" };
  }

  return {
    ok: true,
    data: {
      id: data.id as string,
      conversation_id: data.conversation_id as string,
      role: data.role as MessageRole,
      content: data.content as string,
    },
  };
}

/**
 * Lista mensajes de una conversación existente, ordenados por `created_at` ascendente.
 * Sin `metadata` en la selección. Límite por defecto 50, máximo 100; por debajo de 50 se usa 50.
 */
export async function getMessagesForConversation(
  input: GetMessagesForConversationInput,
): Promise<PersistenceResult<ConversationMessageRow[]>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const existing = await getConversation({
    conversation_id: input.conversation_id,
  });
  if (!existing.ok) {
    return existing;
  }

  const take = resolveMessageLimit(input.limit);

  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", input.conversation_id)
    .order("created_at", { ascending: true })
    .limit(take);

  if (error) {
    return { ok: false, error: "db_error" };
  }

  const rows: ConversationMessageRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    role: row.role as MessageRole,
    content: row.content as string,
    created_at: row.created_at as string,
  }));

  return { ok: true, data: rows };
}

/**
 * Obtiene la fila de `conversation_summaries` para una conversación.
 * Si no hay fila, devuelve `ok: true` con `data: null` (no es error).
 */
export async function getConversationSummary(
  input: GetConversationSummaryInput,
): Promise<PersistenceResult<ConversationSummaryRecord | null>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const { data, error } = await supabase
    .from("conversation_summaries")
    .select(
      "conversation_id, summary, last_message_id, messages_summarized_count, created_at, updated_at, metadata",
    )
    .eq("conversation_id", input.conversation_id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "db_error" };
  }
  if (!data) {
    return { ok: true, data: null };
  }

  return { ok: true, data: mapSummaryRow(data as Record<string, unknown>) };
}

/**
 * Inserta o actualiza el summary de una conversación (`onConflict: conversation_id`).
 * No modifica `messages` ni `conversations`; no invoca modelos.
 */
export async function upsertConversationSummary(
  input: UpsertConversationSummaryInput,
): Promise<PersistenceResult<ConversationSummaryRecord>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const payload = {
    conversation_id: input.conversation_id,
    summary: input.summary,
    last_message_id: input.last_message_id,
    messages_summarized_count: input.messages_summarized_count,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("conversation_summaries")
    .upsert(payload, { onConflict: "conversation_id" })
    .select(
      "conversation_id, summary, last_message_id, messages_summarized_count, created_at, updated_at, metadata",
    )
    .single();

  if (error || !data) {
    return { ok: false, error: "db_error" };
  }

  return { ok: true, data: mapSummaryRow(data as Record<string, unknown>) };
}

/**
 * Mensajes de la conversación en orden `created_at` ascendente, paginados por
 * `offset` / `limit` (límites acotados) para futuros lotes de resumen.
 */
export async function getMessagesForSummaryBatch(
  input: GetMessagesForSummaryBatchInput,
): Promise<PersistenceResult<SummaryBatchMessage[]>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const existing = await getConversation({
    conversation_id: input.conversation_id,
  });
  if (!existing.ok) {
    return existing;
  }

  const offset = resolveSummaryBatchOffset(input.offset);
  const take = resolveSummaryBatchLimit(input.limit);
  const end = offset + take - 1;

  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", input.conversation_id)
    .order("created_at", { ascending: true })
    .range(offset, end);

  if (error) {
    return { ok: false, error: "db_error" };
  }

  const rows: SummaryBatchMessage[] = (data ?? []).map((row) => ({
    id: row.id as string,
    role: row.role as MessageRole,
    content: row.content as string,
    created_at: row.created_at as string,
  }));

  return { ok: true, data: rows };
}

/**
 * Cuenta mensajes de la conversación (exact count, server-side).
 */
export async function countMessagesForConversation(
  input: CountMessagesForConversationInput,
): Promise<PersistenceResult<number>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const existing = await getConversation({
    conversation_id: input.conversation_id,
  });
  if (!existing.ok) {
    return existing;
  }

  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", input.conversation_id);

  if (error) {
    return { ok: false, error: "db_error" };
  }

  return { ok: true, data: count ?? 0 };
}

/**
 * Carga los últimos N mensajes (`user` / `assistant`) de una conversación
 * pensados como **contexto mínimo para el modelo**.
 *
 * - Default y máximo: `CONTEXT_MESSAGE_LIMIT` (6).
 * - Selecciona internamente `role`, `content`, `created_at`; ordena por
 *   `created_at` descendente para tomar los últimos N y devuelve los
 *   resultados en **orden cronológico ascendente**.
 * - No devuelve `metadata`, ni `id`, ni `created_at` al consumidor:
 *   el chat-engine solo recibe `{ role, content }`.
 */
export async function getRecentMessagesForContext(
  input: GetRecentMessagesForContextInput,
): Promise<PersistenceResult<ChatContextMessage[]>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const take = resolveContextLimit(input.limit);

  const { data, error } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", input.conversation_id)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(take);

  if (error) {
    return { ok: false, error: "db_error" };
  }

  const rows = data ?? [];
  const ascending = [...rows].reverse();

  const messages: ChatContextMessage[] = ascending.map((row) => ({
    role: row.role as "user" | "assistant",
    content: row.content as string,
  }));

  return { ok: true, data: messages };
}

/**
 * Lista conversaciones recientes ordenadas por `updated_at` descendente.
 * `last_message_preview` se rellena con el último mensaje `user` o `assistant`
 * de cada conversación (una consulta por id, en paralelo; sin Claude ni summaries).
 * Límite por defecto 20, máximo 50; valores inválidos o menores que 1 usan 20.
 */
export async function getRecentConversations(
  input: GetRecentConversationsInput,
): Promise<PersistenceResult<RecentConversationRow[]>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const take = resolveRecentConversationsLimit(input.limit);

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(take);

  if (error) {
    return { ok: false, error: "db_error" };
  }

  const conversationRows = data ?? [];
  const ids = conversationRows.map((row) => row.id as string);

  const previewById = new Map<string, string | null>();

  if (ids.length > 0) {
    const previewResults = await Promise.all(
      ids.map(async (conversation_id) => {
        const { data: msgRows, error: msgError } = await supabase
          .from("messages")
          .select("content")
          .eq("conversation_id", conversation_id)
          .in("role", ["user", "assistant"])
          .order("created_at", { ascending: false })
          .limit(1);

        if (msgError) {
          return { conversation_id, error: true as const };
        }

        const raw = msgRows?.[0]?.content;
        return {
          conversation_id,
          error: false as const,
          preview: buildLastMessagePreview(
            typeof raw === "string" ? raw : null,
          ),
        };
      }),
    );

    if (previewResults.some((r) => r.error)) {
      return { ok: false, error: "db_error" };
    }

    for (const r of previewResults) {
      if (!r.error) {
        previewById.set(r.conversation_id, r.preview);
      }
    }
  }

  const rows: RecentConversationRow[] = conversationRows.map((row) => ({
    id: row.id as string,
    title: row.title != null ? (row.title as string) : null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    last_message_preview: previewById.get(row.id as string) ?? null,
  }));

  return { ok: true, data: rows };
}

/**
 * Lee `id` y `title` de `conversations` por id. No modifica filas.
 * `not_found` si no existe la conversación; `db_error` ante fallo de Supabase.
 */
export async function getConversationTitleState(
  input: GetConversationTitleStateInput,
): Promise<PersistenceResult<ConversationTitleState>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("id, title")
    .eq("id", input.conversation_id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "db_error" };
  }
  if (!data?.id) {
    return { ok: false, error: "not_found" };
  }

  const titleVal = data.title;
  return {
    ok: true,
    data: {
      id: data.id as string,
      title:
        titleVal === null || titleVal === undefined
          ? null
          : (titleVal as string),
    },
  };
}

/**
 * Actualiza `conversations.title` para un `conversation_id` existente.
 * Sanitiza con trim y tope de longitud; si el resultado es vacío, `invalid_input`.
 * No toca `messages` ni `conversation_summaries`.
 */
export async function updateConversationTitle(
  input: UpdateConversationTitleInput,
): Promise<PersistenceResult<UpdatedConversationTitle>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const sanitized = sanitizeConversationTitleForPersistence(input.title);
  if (sanitized === "") {
    return { ok: false, error: "invalid_input" };
  }

  const existing = await getConversation({
    conversation_id: input.conversation_id,
  });
  if (!existing.ok) {
    return existing;
  }

  const { data, error } = await supabase
    .from("conversations")
    .update({ title: sanitized })
    .eq("id", input.conversation_id)
    .select("id, title")
    .maybeSingle();

  if (error) {
    return { ok: false, error: "db_error" };
  }
  if (!data?.id) {
    return { ok: false, error: "not_found" };
  }

  return {
    ok: true,
    data: {
      id: data.id as string,
      title: data.title as string,
    },
  };
}

/**
 * Primeros mensajes `user`/`assistant` en orden cronológico ascendente.
 * Default `limit` 4, máximo 8; sin `metadata`. No carga el historial completo.
 */
export async function getMessagesForTitleGeneration(
  input: GetMessagesForTitleGenerationInput,
): Promise<PersistenceResult<TitleGenerationMessage[]>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const existing = await getConversation({
    conversation_id: input.conversation_id,
  });
  if (!existing.ok) {
    return existing;
  }

  const take = resolveTitleGenerationLimit(input.limit);

  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", input.conversation_id)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true })
    .limit(take);

  if (error) {
    return { ok: false, error: "db_error" };
  }

  const rows: TitleGenerationMessage[] = (data ?? []).map((row) => ({
    id: row.id as string,
    role: row.role as "user" | "assistant",
    content: row.content as string,
    created_at: row.created_at as string,
  }));

  return { ok: true, data: rows };
}
