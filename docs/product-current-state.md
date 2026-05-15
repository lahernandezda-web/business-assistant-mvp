# Business Assistant MVP — Current Product State

## Purpose

Este documento resume el **estado actual del producto derivado** `business-assistant-mvp`: qué está implementado, qué está verificado y qué queda fuera de alcance. Sirve como checkpoint rápido para futuros bloques de trabajo (Cursor, revisiones, specs de módulos, etc.).

**No describe la base congelada** `CURSOR.p1`. Para la base reutilizable, ver la documentación y specs heredadas en este repo (`docs/current-state.md`, specs de chat/automatización, etc.).

---

## Product Boundary

| Ámbito | Regla |
|--------|--------|
| **Producto** | Vive en `C:\Users\luish\Desktop\business-assistant-mvp`. Aquí se construyen módulos de negocio (Business Profile, contactos futuros, etc.). |
| **Base** | `CURSOR.p1` es la **base completada y congelada**. No modificarla ni construir productos dentro de ella. |
| **Derivación** | El producto se creó desde la base (`chore: initialize business assistant product from base`) y evoluciona con commits propios. |

---

## Current Status

| Área | Estado |
|------|--------|
| **Business Profile MVP** | Completado (SQL, API, UI, integración con chat). |
| **Chat base** | Funcional con **Claude** en local; stub sigue disponible si se configura `AI_PROVIDER=stub`. |
| **Supabase** | Configurado (proyecto propio del producto). |
| **Claude** | Activado manualmente en entorno local (`web/.env.local`; clave no documentada). Modelo: `claude-haiku-4-5`. |
| **Límites de capacidades** | Bloque *Current product capabilities* en system prompt (`chat-engine.ts`). |
| **n8n / automatizaciones** | Desactivado en producto (`AUTOMATIONS_ENABLED=false`). |
| **Contacts MVP v1** | Completado (SPEC, SQL, API GET/POST, UI `/contacts`). Sin integración con chat. |
| **Follow-up tasks** | No implementados. |
| **Auth / multi-tenant** | No implementados. |

**Commits relevantes del producto:**

- `chore: initialize business assistant product from base`
- `docs: add business assistant product MVP spec`
- `docs: add business profile MVP spec`
- `db: add business profiles schema`
- `feat: add business profile API`
- `feat: add business profile UI`
- `feat: inject business profile into chat context`
- `feat: add assistant capability boundaries`
- `feat: add contacts UI` (API/SQL/SPEC en bloques previos del módulo Contacts)

---

## Implemented Modules

### Base inherited from CURSOR.p1

Capacidades reutilizadas en el producto (sin duplicar la base):

- **Chat UI** — `/chat`, envío de turnos, historial y lista de conversaciones.
- **Persistencia** — `conversations`, `messages`, `conversation_summaries` vía Supabase server-side.
- **Summaries** — Resumen acumulado por conversación; ventana reciente al modelo.
- **Conversation list** — Lista reciente con títulos, preview y búsqueda local en UI.
- **Automation base** — Cliente y eventos existen en código; en este producto permanecen **desactivados** (`AUTOMATIONS_ENABLED=false`).
- **Diagnostics** — Endpoints de estado (`/api/health`, `/api/ai/status`, `/api/supabase/status`, etc.) sin exponer secretos.

### Business Profile MVP

#### SQL

- **Archivo:** `supabase/product-business-profile.sql`
- **Tabla:** `public.business_profiles`
- **Campos principales:** `id`, `name`, `industry`, `description`, `target_customer`, `tone`, `services`, `location`, `website`, `metadata`, `created_at`, `updated_at`

#### API

- **Módulo:** `web/lib/business-profile/types.ts`, `validate-input.ts`, `persistence.ts`
- **Ruta:** `web/app/api/business-profile/route.ts`
- **Endpoints:**
  - `GET /api/business-profile` — perfil más reciente o `{ "profile": null }`
  - `POST /api/business-profile` — crea un nuevo perfil (siempre insert, sin upsert)
- **Reglas:** `name` obligatorio; opcionales como `string` o `null`; strings vacíos opcionales → `null`; `metadata` objeto plano; validación → 400; errores internos → mensajes seguros (sin crudo de Supabase ni claves).

#### UI

- **Archivo:** `web/app/business-profile/page.tsx`
- **Ruta:** `/business-profile`
- **Comportamiento:** carga perfil actual; formulario; estados de carga/guardado/error; guardar crea nuevo perfil y recarga el más reciente.

#### Chat Context Integration

- **Formateo:** `web/lib/business-profile/format-context.ts` — `formatBusinessProfileContext()` (bloque compacto; solo campos con valor).
- **Carga:** `web/app/api/chat/turn/route.ts` — `getLatestBusinessProfile()` antes de `handleChatTurn()`.
- **Tipos / motor:** `web/lib/chat/types.ts`, `web/lib/chat/chat-engine.ts` — campo opcional `business_profile_context`; inyección como mensaje de contexto interno (no visible al usuario como bloque repetido).
- **Stub:** `web/lib/ai/fake-provider.ts` — si hay contexto de negocio, la respuesta incluye `[stub: business context received]` sin imprimir el perfil completo.

**Comportamiento de degradación:**

- Sin perfil → el chat funciona igual que antes.
- Error al cargar perfil → `console.warn` y el turno continúa sin contexto de negocio (no bloquea el chat).

### Contacts MVP v1

#### SPEC

- **Archivo:** `docs/spec-contacts-mvp.md`

#### SQL

- **Archivo:** `supabase/product-contacts.sql`
- **Tabla:** `public.contacts` (ejecutado manualmente en Supabase)
- **Campos principales:** `id`, `name`, `email`, `phone`, `source`, `status`, `contact_type`, `interest`, `notes`, `last_contacted_at`, `next_follow_up_at`, `metadata`, `created_at`, `updated_at`

#### API

- **Módulo:** `web/lib/contacts/types.ts`, `validate-input.ts`, `persistence.ts`
- **Ruta:** `web/app/api/contacts/route.ts`
- **Endpoints:**
  - `GET /api/contacts` — hasta 50 contactos recientes (`created_at` desc)
  - `POST /api/contacts` — crea contacto validado
- **Reglas:** `name` obligatorio; `status` y `contact_type` validados; fechas ISO o `null`; `metadata` objeto plano; 400 input inválido; 500 errores seguros.

#### UI

- **Archivo:** `web/app/contacts/page.tsx`
- **Ruta:** `/contacts`
- **Comportamiento:** carga y listado; estado vacío; formulario de creación; validación de `name` en UI; estados loading/saving/error/éxito; nuevo contacto arriba; persiste tras recargar; nota de privacidad (no datos clínicos sensibles).

**Sin integración con chat ni automatizaciones en este MVP.**

---

## Verified Behavior

Comportamiento comprobado en el producto:

| Verificación | Resultado |
|--------------|-----------|
| `/business-profile` | Carga y guarda perfiles. |
| `GET /api/business-profile` | Devuelve perfil o `profile: null`. |
| `POST /api/business-profile` | Crea perfil nuevo. |
| `/chat` | Sigue funcionando (conversación, persistencia, historial). |
| `POST /api/chat/turn` | Recibe contexto del negocio si existe perfil en BD. |
| Modo stub | Respuesta incluye `[stub: business context received]` cuando hay contexto; no imprime el perfil completo. |
| `npm run lint` (desde `web/`) | OK |
| `npx tsc --noEmit` (desde `web/`) | OK |
| `GET /api/contacts` | Lista contactos (vacía o con datos). |
| `POST /api/contacts` | Crea contacto válido; 400 si input inválido. |
| `/contacts` | Carga, crea contacto (p. ej. «Paciente UI prueba»), aparece en lista y persiste tras recargar. |

---

## Claude Activation Checkpoint

Checkpoint tras **Controlled Claude Activation** y **Assistant Capability Boundaries MVP**.

### 1. Activación de Claude

- **Proveedor IA actual:** Claude (`AI_PROVIDER=claude`).
- **Modelo:** `claude-haiku-4-5`.
- La API key está en `web/.env.local` (solo entorno local); **no** debe imprimirse, leerse en chats ni documentarse aquí.
- La activación fue **manual y local** por el usuario del producto.

### 2. Verificación realizada

| Prueba | Resultado |
|--------|-----------|
| `GET /api/ai/status` | `provider: claude`, `model: claude-haiku-4-5`, `has_api_key: true` (sin exponer la clave). |
| `POST /api/chat/turn` / `/chat` | Respuesta con Claude real (no stub). |
| Business Profile en contexto | Claude usó el perfil guardado. |
| Reconocimiento del negocio | Clínica dental (perfil de prueba). |
| Servicios del perfil | Ortodoncia, dolor dental, radiografías reflejados en la respuesta. |
| Persistencia | Conversación y mensajes siguieron guardándose en Supabase. |

### 3. Corrección de límites de capacidades

- **Problema detectado:** Claude podía describir WhatsApp, web pública u otras integraciones como si ya estuvieran activas.
- **Cambio:** bloque **Current product capabilities** en el system prompt (`web/lib/chat/chat-engine.ts`, commit `feat: add assistant capability boundaries`).
- **Comportamiento esperado:** el asistente distingue entre:
  - **Capacidades actuales** — chat local, contexto de Business Profile, redacción/razonamiento/planificación en conversación.
  - **Ayuda para planificar procesos** — borradores, flujos sugeridos, mensajes tipo plantilla (sin ejecutar integraciones).
  - **Integraciones futuras** — WhatsApp, agenda, CRM, etc. como planificables o implementables más adelante, sin afirmar que ya están conectadas.

### 4. Capacidades actuales reales

El producto **sí** puede hoy:

- Responder en `/chat` con Claude (o stub si se configura).
- Usar el **Business Profile** más reciente como contexto interno del turno.
- Ayudar a **redactar, razonar, resumir, planificar** y **sugerir workflows** en texto.
- **Persistir** conversaciones y mensajes en Supabase.
- Usar **resumen acumulado** y **ventana reciente** de mensajes (heredado de la base).
- Listar conversaciones y títulos en UI (heredado de la base).

### 5. Capacidades NO implementadas todavía

El producto **no** tiene aún (no debe presentarse como activo):

| Área | Estado |
|------|--------|
| WhatsApp | No implementado |
| Web widget público | No implementado |
| Email conectado | No implementado |
| Calendar / agenda real | No implementado |
| CRM real | No implementado |
| Pagos / billing | No implementado |
| Llamadas telefónicas | No implementado |
| Voz | No implementada |
| n8n activo para negocio | Desactivado (`AUTOMATIONS_ENABLED=false`) |
| Automatizaciones externas reales | No implementadas |
| Contacts MVP (listar/crear manual) | Implementado |
| `follow_up_tasks` | No implementados |
| Edición/búsqueda/automatización de contactos | No implementados |

### 6. Próximo paso (referencia)

Ver sección **Recommended Next Step** más abajo: **Follow-up Tasks MVP — SPEC**.

---

## Contacts MVP Checkpoint

Checkpoint tras completar **Contacts MVP v1** (SPEC, SQL, API mínima, UI `/contacts`).

### 1. Estado actual

- **Contacts MVP v1 completado.**
- SPEC creada (`docs/spec-contacts-mvp.md`).
- SQL creado y **ejecutado manualmente** en Supabase (`public.contacts`).
- API mínima **GET/POST** implementada.
- UI mínima **`/contacts`** implementada.
- **No** hay integración con chat todavía.
- **No** hay automatizaciones todavía.

### 2. Qué permite hacer ahora

- Listar contactos recientes.
- Crear contactos manualmente desde la UI.
- Guardar datos **administrativos/comerciales mínimos** (nombre, email, teléfono, fuente, estado, tipo, interés, notas, próximo seguimiento).
- Registrar interés, fuente, estado, tipo, notas y fecha de próximo seguimiento.

### 3. Qué NO permite todavía

- Editar contactos.
- Eliminar contactos.
- Ver detalle individual.
- Buscar o filtrar.
- Integrarse con chat.
- Detectar leads automáticamente.
- Enviar WhatsApp o email.
- Agendar citas reales.
- Crear tareas de seguimiento automáticamente.
- Ejecutar automatizaciones (n8n u otras).

### 4. Seguridad y privacidad

- **Contacts MVP no debe usarse para historia clínica.**
- **No** guardar diagnósticos ni tratamientos clínicos.
- **No** guardar documentos identificativos ni tarjetas de pago.
- **Minimizar** datos personales; `notes` e `interest` solo para contexto comercial/administrativo.
- **No** enviar el listado completo de contactos a Claude salvo necesidad explícita en fases futuras (contexto mínimo).
- Mantener **control humano** sobre cualquier seguimiento o acción futura.

### 5. Próximo paso (referencia)

Ver **Recommended Next Step**: **Follow-up Tasks MVP — SPEC**.

---

## Security Notes

- **No imprimir** `web/.env.local` ni pegar claves en chats o documentación.
- **Supabase service role** — solo server-side (`createSupabaseServerClient()` en rutas/lib servidor).
- **Claude API key** — solo server-side en `web/.env.local`; activada localmente en este checkpoint; no documentar ni imprimir el valor.
- **n8n webhook secret** — solo server-side; no activar n8n sin decisión explícita.
- **Contexto al modelo** — ventana reciente acotada + summary; **no** enviar historial completo a proveedores de IA.
- **Business Profile en chat** — bloque compacto; sin loguear payloads completos ni secretos.
- **Contacts** — no almacenar datos clínicos sensibles; no volcar contactos completos al modelo; seguimiento con confirmación humana.
- **Errores de API** — mensajes seguros al cliente; sin exponer errores crudos de Supabase.

---

## Out of Scope Right Now

No forman parte del estado actual ni del siguiente paso documentado aquí:

- Edición/búsqueda/automatización de contactos; integración contacts ↔ chat
- `follow_up_tasks`
- WhatsApp, voz
- Billing, dashboard complejo
- Multi-tenant, auth avanzada
- Automatizaciones irreversibles, agentes autónomos
- Dominios sensibles: fiscalidad, legal, médico

---

## Recommended Next Step

**Bloque recomendado:** **Follow-up Tasks MVP — SPEC**

Objetivo del siguiente bloque (solo documentación / diseño):

1. Definir **tareas simples de seguimiento** (asociadas o no a contactos).
2. **No** crear SQL todavía.
3. **No** implementar API todavía.
4. **No** automatizar envíos (WhatsApp, email, etc.).
5. Mantener **confirmación humana** para cualquier acción futura.
6. Alinear con Contacts MVP y Business Profile sin prometer CRM ni automatizaciones activas.

**Completado en bloques anteriores (referencia):** Controlled Claude Activation, Assistant Capability Boundaries MVP, Contacts MVP v1.
