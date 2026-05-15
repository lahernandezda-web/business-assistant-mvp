import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BusinessProfile,
  CreateBusinessProfileInput,
  PersistenceResult,
} from "./types";

/**
 * Capa interna de persistencia de Business Profile (Supabase, server-side).
 *
 * Reglas:
 * - Solo se usa desde servidor (API routes).
 * - Usa siempre `createSupabaseServerClient()` — nunca desde el navegador.
 * - No expone errores crudos de Supabase ni claves.
 */

function mapRowToBusinessProfile(row: Record<string, unknown>): BusinessProfile {
  const metadata = row.metadata;
  return {
    id: row.id as string,
    name: row.name as string,
    industry: row.industry == null ? null : (row.industry as string),
    description:
      row.description == null ? null : (row.description as string),
    target_customer:
      row.target_customer == null ? null : (row.target_customer as string),
    tone: row.tone == null ? null : (row.tone as string),
    services: row.services == null ? null : (row.services as string),
    location: row.location == null ? null : (row.location as string),
    website: row.website == null ? null : (row.website as string),
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
 * Devuelve el perfil más reciente (`created_at` desc) o `null` si no hay filas.
 */
export async function getLatestBusinessProfile(): Promise<
  PersistenceResult<BusinessProfile | null>
> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const { data, error } = await supabase
    .from("business_profiles")
    .select(
      "id, name, industry, description, target_customer, tone, services, location, website, metadata, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "db_error" };
  }

  if (!data) {
    return { ok: true, data: null };
  }

  return { ok: true, data: mapRowToBusinessProfile(data as Record<string, unknown>) };
}

/**
 * Inserta un nuevo perfil en `business_profiles` (siempre create, sin upsert).
 */
export async function createBusinessProfile(
  input: CreateBusinessProfileInput,
): Promise<PersistenceResult<BusinessProfile>> {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "not_configured" };
  }

  const row = {
    name: input.name,
    industry: input.industry ?? null,
    description: input.description ?? null,
    target_customer: input.target_customer ?? null,
    tone: input.tone ?? null,
    services: input.services ?? null,
    location: input.location ?? null,
    website: input.website ?? null,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("business_profiles")
    .insert(row)
    .select(
      "id, name, industry, description, target_customer, tone, services, location, website, metadata, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    return { ok: false, error: "db_error" };
  }

  return {
    ok: true,
    data: mapRowToBusinessProfile(data as Record<string, unknown>),
  };
}
