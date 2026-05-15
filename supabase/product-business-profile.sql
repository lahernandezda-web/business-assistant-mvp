-- Business Assistant MVP — SQL específico del producto (Business Profile).
--
-- Uso: copiar y ejecutar manualmente en el SQL Editor del panel de Supabase
-- del proyecto Business Assistant, cuando corresponda (Phase 3).
-- Este archivo no se ejecuta automáticamente desde el repo.
--
-- Separado de supabase/schema.sql (base conversacional: conversations, messages,
-- conversation_summaries).
--
-- RLS / auth / tenants:
--   Para este MVP el acceso previsto es solo server-side con service role.
--   No se activan políticas RLS aquí.

-- gen_random_uuid() está disponible en Supabase (PostgreSQL + pgcrypto).

-- ---------------------------------------------------------------------------
-- Tabla: business_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  description text,
  target_customer text,
  tone text,
  services text,
  location text,
  website text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.business_profiles is 'Perfil comercial básico del negocio (Business Profile MVP).';

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index if not exists idx_business_profiles_created_at
  on public.business_profiles (created_at desc);

-- ---------------------------------------------------------------------------
-- Trigger: updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_profiles_set_updated_at on public.business_profiles;
create trigger business_profiles_set_updated_at
  before update on public.business_profiles
  for each row
  execute function public.set_updated_at();
