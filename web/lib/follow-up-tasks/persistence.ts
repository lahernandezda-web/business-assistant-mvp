import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CreateFollowUpTaskInput,
  FollowUpTask,
  FollowUpTaskPriority,
  FollowUpTaskStatus,
  PersistenceResult,
} from "./types";

const FOLLOW_UP_TASK_COLUMNS =
  "id, contact_id, title, description, status, priority, due_at, completed_at, source, metadata, created_at, updated_at";

const DEFAULT_LIST_LIMIT = 50;

/**
 * Capa interna de persistencia de Follow-up Tasks (Supabase, server-side).
 *
 * Reglas:
 * - Solo se usa desde servidor (API routes).
 * - Usa siempre `createSupabaseServerClient()` — nunca desde el navegador.
 * - No expone errores crudos de Supabase ni claves.
 */

function mapRowToFollowUpTask(row: Record<string, unknown>): FollowUpTask {
  const metadata = row.metadata;
  return {
    id: row.id as string,
    contact_id: row.contact_id == null ? null : (row.contact_id as string),
    title: row.title as string,
    description: row.description == null ? null : (row.description as string),
    status: row.status as FollowUpTaskStatus,
    priority: row.priority as FollowUpTaskPriority,
    due_at: row.due_at == null ? null : (row.due_at as string),
    completed_at:
      row.completed_at == null ? null : (row.completed_at as string),
    source: row.source == null ? null : (row.source as string),
    metadata:
      metadata !== null &&
      typeof metadata === "object" &&
      !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/**
 * Devuelve tareas recientes (`created_at` desc), hasta `limit` filas.
 */
export async function getRecentFollowUpTasks(
  limit: number = DEFAULT_LIST_LIMIT,
): Promise<PersistenceResult<FollowUpTask[]>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const safeLimit =
    Number.isFinite(limit) && limit > 0
      ? Math.min(Math.floor(limit), 100)
      : DEFAULT_LIST_LIMIT;

  const { data, error } = await supabase
    .from("follow_up_tasks")
    .select(FOLLOW_UP_TASK_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    return { ok: false, error: "db_error" };
  }

  const tasks = (data ?? []).map((row) =>
    mapRowToFollowUpTask(row as Record<string, unknown>),
  );

  return { ok: true, data: tasks };
}

/**
 * Inserta una nueva tarea en `follow_up_tasks` (siempre create, sin upsert).
 */
export async function createFollowUpTask(
  input: CreateFollowUpTaskInput,
): Promise<PersistenceResult<FollowUpTask>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const row = {
    contact_id: input.contact_id ?? null,
    title: input.title,
    description: input.description ?? null,
    status: input.status ?? "open",
    priority: input.priority ?? "normal",
    due_at: input.due_at ?? null,
    completed_at: input.completed_at ?? null,
    source: input.source ?? null,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("follow_up_tasks")
    .insert(row)
    .select(FOLLOW_UP_TASK_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, error: "db_error" };
  }

  return {
    ok: true,
    data: mapRowToFollowUpTask(data as Record<string, unknown>),
  };
}
