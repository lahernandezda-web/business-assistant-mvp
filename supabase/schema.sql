-- Supabase Persistence MVP — esquema (conversations / messages /
-- conversation_summaries preparada para Summary MVP).
--
-- Uso: copiar y ejecutar manualmente en el SQL Editor del panel de Supabase.
-- Este archivo no se ejecuta automáticamente desde el repo.
--
-- RLS / auth / tenants:
--   Para este MVP el acceso previsto es solo server-side con service role.
--   No se activan políticas RLS aquí. En una fase posterior se añadirán
--   Row Level Security, autenticación y aislamiento multi-tenant según modelo
--   de identidad del producto.

-- gen_random_uuid() está disponible en Supabase (PostgreSQL + pgcrypto).

-- ---------------------------------------------------------------------------
-- Tabla: conversations
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.conversations is 'Conversaciones de chat (MVP persistencia).';

-- ---------------------------------------------------------------------------
-- Tabla: messages
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint messages_role_check check (role in ('user', 'assistant', 'system'))
);

comment on table public.messages is 'Mensajes por conversación (MVP persistencia).';

-- ---------------------------------------------------------------------------
-- Tabla: conversation_summaries (Conversation Summary MVP)
-- ---------------------------------------------------------------------------
-- Una fila por conversación (PK = conversation_id). Almacena el resumen
-- acumulado del hilo; la app ya lee y escribe aquí como parte del MVP
-- (servidor: getConversationSummary, upsertConversationSummary, lotes de resumen).
create table if not exists public.conversation_summaries (
  conversation_id uuid primary key references public.conversations (id) on delete cascade,
  summary text not null default '',
  last_message_id uuid null references public.messages (id) on delete set null,
  messages_summarized_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.conversation_summaries is 'Resumen acumulado por conversación (Conversation Summary MVP; usada por la app en servidor).';
comment on column public.conversation_summaries.last_message_id is 'Último mensaje del hilo incluido en el último ciclo de summary acumulado (nullable hasta la primera generación).';
comment on column public.conversation_summaries.messages_summarized_count is 'Cuántos mensajes del hilo contabiliza el summary actual (reglas de actualización en código del MVP).';

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index if not exists messages_conversation_id_created_at_idx
  on public.messages (conversation_id, created_at);

create index if not exists conversations_updated_at_idx
  on public.conversations (updated_at);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at (conversations, conversation_summaries) y bump por mensaje
-- ---------------------------------------------------------------------------
-- 1) Al actualizar la fila de conversación (p. ej. title, metadata).
create or replace function public.set_conversations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists conversations_set_updated_at on public.conversations;
create trigger conversations_set_updated_at
  before update on public.conversations
  for each row
  execute function public.set_conversations_updated_at();

-- 2) Al insertar un mensaje, reflejar actividad en la conversación padre.
create or replace function public.bump_conversation_updated_at_from_message()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_conversation_updated_at on public.messages;
create trigger messages_bump_conversation_updated_at
  after insert on public.messages
  for each row
  execute function public.bump_conversation_updated_at_from_message();

-- 3) updated_at en conversation_summaries (misma lógica que conversations).
drop trigger if exists conversation_summaries_set_updated_at on public.conversation_summaries;
create trigger conversation_summaries_set_updated_at
  before update on public.conversation_summaries
  for each row
  execute function public.set_conversations_updated_at();
