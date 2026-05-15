-- Business Assistant MVP — SQL específico del producto (Contacts).
--
-- Uso: copiar y ejecutar manualmente en el SQL Editor del panel de Supabase
-- del proyecto Business Assistant, cuando corresponda (Phase 3).
-- Este archivo no se ejecuta automáticamente desde el repo.
--
-- Ejecutar DESPUÉS de supabase/product-business-profile.sql (requiere
-- public.set_updated_at() definida allí).
--
-- Separado de supabase/schema.sql (base conversacional).
-- Spec: docs/spec-contacts-mvp.md
--
-- Contacts MVP: información administrativa/comercial mínima únicamente.
-- NO usar para historia clínica, diagnósticos, tratamientos ni datos médicos sensibles.
--
-- RLS / auth / tenants:
--   Para este MVP el acceso previsto es solo server-side con service role.
--   No se activan políticas RLS aquí.

-- gen_random_uuid() está disponible en Supabase (PostgreSQL + pgcrypto).

-- ---------------------------------------------------------------------------
-- Tabla: contacts
-- ---------------------------------------------------------------------------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text null,
  phone text null,
  source text null,
  status text not null default 'new',
  contact_type text null,
  interest text null,
  notes text null,
  last_contacted_at timestamptz null,
  next_follow_up_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contacts is
  'Contactos del negocio (Contacts MVP): seguimiento administrativo/comercial mínimo. '
  'No almacenar historia clínica ni datos médicos sensibles.';

comment on column public.contacts.id is 'Identificador único del contacto.';
comment on column public.contacts.name is 'Nombre de la persona o referencia (obligatorio).';
comment on column public.contacts.email is 'Email de contacto; opcional si hay teléfono.';
comment on column public.contacts.phone is 'Teléfono de contacto; opcional si hay email.';
comment on column public.contacts.source is
  'Origen del contacto (web, recomendación, walk-in, chat, etc.).';
comment on column public.contacts.status is
  'Estado de seguimiento comercial (texto libre en MVP; valores esperados: '
  'new, contacted, interested, not_interested, converted, archived). '
  'Sin check constraint en MVP para mantener flexibilidad.';
comment on column public.contacts.contact_type is
  'Tipo de relación (texto libre en MVP; valores esperados: '
  'lead, customer, patient, supplier, other). '
  'Sin check constraint en MVP; patient aquí es solo etiqueta administrativa, no dato clínico.';
comment on column public.contacts.interest is
  'Motivo de consulta o interés comercial (ej. primera visita, blanqueamiento). No usar para diagnósticos.';
comment on column public.contacts.notes is
  'Notas libres no clínicas. No guardar historia clínica, tratamientos ni datos sensibles.';
comment on column public.contacts.last_contacted_at is
  'Última vez que se contactó a la persona (registro manual o futuro).';
comment on column public.contacts.next_follow_up_at is
  'Recordatorio opcional de siguiente seguimiento comercial.';
comment on column public.contacts.metadata is
  'Extensiones ligeras (JSON). No usar para evadir restricciones ni almacenar PHI/datos clínicos.';
comment on column public.contacts.created_at is 'Fecha de alta del registro.';
comment on column public.contacts.updated_at is
  'Fecha de última modificación; actualizada por trigger contacts_set_updated_at.';

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index if not exists idx_contacts_created_at
  on public.contacts (created_at desc);

create index if not exists idx_contacts_status
  on public.contacts (status);

create index if not exists idx_contacts_next_follow_up_at
  on public.contacts (next_follow_up_at)
  where next_follow_up_at is not null;

-- ---------------------------------------------------------------------------
-- Trigger: updated_at (usa public.set_updated_at de product-business-profile.sql)
-- ---------------------------------------------------------------------------
drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row
  execute function public.set_updated_at();
