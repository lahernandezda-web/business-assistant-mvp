export type SupabaseServerStatusPayload = {
  configured: boolean;
  has_url: boolean;
  has_anon_key: boolean;
  has_service_role_key: boolean;
};

/**
 * Diagnóstico de variables Supabase (solo `process.env`).
 * No expone URL ni claves ni fragmentos; no lee archivos `.env`.
 * No ejecuta queries contra Supabase (no valida tablas ni persistencia).
 */
export function getSupabaseServerStatus(): SupabaseServerStatusPayload {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim());
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
  const hasServiceRoleKey = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );

  return {
    configured: hasUrl && hasAnonKey && hasServiceRoleKey,
    has_url: hasUrl,
    has_anon_key: hasAnonKey,
    has_service_role_key: hasServiceRoleKey,
  };
}
