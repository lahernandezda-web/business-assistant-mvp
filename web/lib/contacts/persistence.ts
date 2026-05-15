import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Contact,
  ContactStatus,
  ContactType,
  CreateContactInput,
  PersistenceResult,
} from "./types";

const CONTACT_COLUMNS =
  "id, name, email, phone, source, status, contact_type, interest, notes, last_contacted_at, next_follow_up_at, metadata, created_at, updated_at";

const DEFAULT_LIST_LIMIT = 50;

/**
 * Capa interna de persistencia de Contacts (Supabase, server-side).
 *
 * Reglas:
 * - Solo se usa desde servidor (API routes).
 * - Usa siempre `createSupabaseServerClient()` — nunca desde el navegador.
 * - No expone errores crudos de Supabase ni claves.
 */

function mapRowToContact(row: Record<string, unknown>): Contact {
  const metadata = row.metadata;
  const rawContactType = row.contact_type;
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email == null ? null : (row.email as string),
    phone: row.phone == null ? null : (row.phone as string),
    source: row.source == null ? null : (row.source as string),
    status: row.status as ContactStatus,
    contact_type:
      rawContactType == null || rawContactType === ""
        ? null
        : (rawContactType as ContactType),
    interest: row.interest == null ? null : (row.interest as string),
    notes: row.notes == null ? null : (row.notes as string),
    last_contacted_at:
      row.last_contacted_at == null
        ? null
        : (row.last_contacted_at as string),
    next_follow_up_at:
      row.next_follow_up_at == null
        ? null
        : (row.next_follow_up_at as string),
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
 * Devuelve contactos recientes (`created_at` desc), hasta `limit` filas.
 */
export async function getRecentContacts(
  limit: number = DEFAULT_LIST_LIMIT,
): Promise<PersistenceResult<Contact[]>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : DEFAULT_LIST_LIMIT;

  const { data, error } = await supabase
    .from("contacts")
    .select(CONTACT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    return { ok: false, error: "db_error" };
  }

  const contacts = (data ?? []).map((row) =>
    mapRowToContact(row as Record<string, unknown>),
  );

  return { ok: true, data: contacts };
}

/**
 * Inserta un nuevo contacto en `contacts` (siempre create, sin upsert).
 */
export async function createContact(
  input: CreateContactInput,
): Promise<PersistenceResult<Contact>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const row = {
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    source: input.source ?? null,
    status: input.status ?? "new",
    contact_type: input.contact_type ?? null,
    interest: input.interest ?? null,
    notes: input.notes ?? null,
    last_contacted_at: input.last_contacted_at ?? null,
    next_follow_up_at: input.next_follow_up_at ?? null,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("contacts")
    .insert(row)
    .select(CONTACT_COLUMNS)
    .single();

  if (error || !data) {
    return { ok: false, error: "db_error" };
  }

  return {
    ok: true,
    data: mapRowToContact(data as Record<string, unknown>),
  };
}
