-- Business Assistant MVP — SQL específico del producto (Follow-up Tasks).
--
-- Uso: copiar y ejecutar manualmente en el SQL Editor del panel de Supabase
-- del proyecto Business Assistant, cuando corresponda (Phase 3).
-- Este archivo no se ejecuta automáticamente desde el repo.
--
-- Ejecutar DESPUÉS de:
--   supabase/schema.sql
--   supabase/product-business-profile.sql  (requiere public.set_updated_at())
--   supabase/product-contacts.sql          (requiere public.contacts)
--
-- Separado de supabase/schema.sql (base conversacional).
-- Spec: docs/spec-follow-up-tasks-mvp.md
--
-- Follow-up Tasks MVP: tareas administrativas/comerciales simples de seguimiento.
-- NO usar para historia clínica, diagnósticos, tratamientos ni datos médicos sensibles.
--
-- RLS / auth / tenants:
--   Para este MVP el acceso previsto es solo server-side con service role.
--   No se activan políticas RLS aquí.

-- gen_random_uuid() está disponible en Supabase (PostgreSQL + pgcrypto).

-- ---------------------------------------------------------------------------
-- Tabla: follow_up_tasks
-- ---------------------------------------------------------------------------
create table if not exists public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid null references public.contacts(id) on delete set null,
  title text not null,
  description text null,
  status text not null default 'open',
  priority text not null default 'normal',
  due_at timestamptz null,
  completed_at timestamptz null,
  source text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.follow_up_tasks is
  'Tareas de seguimiento (Follow-up Tasks MVP): acciones administrativas/comerciales simples. '
  'No almacenar historia clínica, diagnósticos, tratamientos ni datos médicos sensibles.';

comment on column public.follow_up_tasks.id is 'Identificador único de la tarea.';
comment on column public.follow_up_tasks.contact_id is
  'Contacto asociado opcional (FK → public.contacts). ON DELETE SET NULL: '
  'si se elimina el contacto, la tarea permanece sin vínculo.';
comment on column public.follow_up_tasks.title is
  'Título breve y accionable (obligatorio). Solo texto administrativo/comercial.';
comment on column public.follow_up_tasks.description is
  'Detalle opcional de la tarea. No usar para notas clínicas ni datos sensibles.';
comment on column public.follow_up_tasks.status is
  'Estado de la tarea (texto libre en MVP; valores esperados: '
  'open, in_progress, completed, cancelled, archived). '
  'Sin check constraint en MVP para mantener flexibilidad.';
comment on column public.follow_up_tasks.priority is
  'Prioridad básica (texto libre en MVP; valores esperados: '
  'low, normal, high, urgent). '
  'Sin check constraint en MVP para mantener flexibilidad.';
comment on column public.follow_up_tasks.due_at is
  'Fecha/hora límite o recordatorio de seguimiento; opcional.';
comment on column public.follow_up_tasks.completed_at is
  'Momento en que se marcó como completada; NULL si no aplica. '
  'Debería rellenarse al pasar status a completed (lógica en app/API futura).';
comment on column public.follow_up_tasks.source is
  'Origen de la tarea (texto libre en MVP; valores esperados: '
  'manual, chat_suggestion, system). '
  'Sin check constraint en MVP para mantener flexibilidad.';
comment on column public.follow_up_tasks.metadata is
  'Extensiones ligeras (JSON). No usar para evadir restricciones ni almacenar PHI/datos clínicos.';
comment on column public.follow_up_tasks.created_at is 'Fecha de alta del registro.';
comment on column public.follow_up_tasks.updated_at is
  'Fecha de última modificación; actualizada por trigger follow_up_tasks_set_updated_at.';

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index if not exists idx_follow_up_tasks_created_at
  on public.follow_up_tasks (created_at desc);

create index if not exists idx_follow_up_tasks_status
  on public.follow_up_tasks (status);

create index if not exists idx_follow_up_tasks_due_at
  on public.follow_up_tasks (due_at)
  where due_at is not null;

create index if not exists idx_follow_up_tasks_contact_id
  on public.follow_up_tasks (contact_id)
  where contact_id is not null;

create index if not exists idx_follow_up_tasks_completed_at
  on public.follow_up_tasks (completed_at)
  where completed_at is not null;

-- ---------------------------------------------------------------------------
-- Trigger: updated_at (usa public.set_updated_at de product-business-profile.sql)
-- ---------------------------------------------------------------------------
drop trigger if exists follow_up_tasks_set_updated_at on public.follow_up_tasks;
create trigger follow_up_tasks_set_updated_at
  before update on public.follow_up_tasks
  for each row
  execute function public.set_updated_at();
