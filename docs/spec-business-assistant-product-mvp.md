# Business Assistant Product MVP Spec

**Tipo:** especificación de producto (documento único de referencia).  
**Estado:** SPEC inicial — **sin implementación** de código, tablas, UI de producto ni automatizaciones de negocio.  
**Base congelada de referencia:** `CURSOR.p1` (no modificar).  
**Repositorio del producto:** `business-assistant-mvp` (derivado de la base reutilizable).

---

## 1. Purpose

**Business Assistant MVP** es el **primer producto concreto** construido encima de la base reutilizable (motor conversacional, persistencia, resúmenes, títulos, capa de proveedor de IA y cliente de automatizaciones genérico).

Su propósito es ayudar a un **negocio pequeño** a:

- **Centralizar conversaciones** con un asistente que conoce el contexto del negocio.
- **Registrar información básica del negocio** (perfil comercial mínimo).
- **Guardar datos simples de clientes o leads** sin convertirse en un CRM completo.
- **Asistir en respuestas** alineadas al tono y servicios del negocio.
- **Resumir conversaciones** y recuperar el hilo sin reenviar historial completo al modelo.
- **Preparar próximos pasos** y sugerencias de seguimiento con **confirmación humana**.
- **Dejar base preparada** para futuras automatizaciones de negocio con **n8n**, sin activarlas de forma agresiva en el MVP inicial.

Filosofía del producto: **simplicidad**, **bloques pequeños**, **control humano**, **coste bajo**, **sin sobreingeniería** y **sin agentes autónomos sin supervisión**.

---

## 2. Product vs Base Boundary

### BASE reutilizable (framework / motor)

Capacidades que **permanecen genéricas** y no definen el dominio “negocio”:

| Capacidad | Descripción breve |
|-----------|-------------------|
| Chat engine | Turnos, validación, flujo `POST /api/chat/turn` |
| Claude provider layer | Llamadas server-side, modo stub según configuración |
| Supabase persistence | Conversaciones, mensajes, resúmenes |
| Conversation history | Carga completa para UI; ventana acotada al modelo |
| Summaries | Resumen acumulado por conversación |
| Titles | Títulos automáticos de conversación |
| Automation client | Cliente server-side hacia n8n |
| `conversation.created` | Evento genérico al crear conversación nueva |
| Diagnostics | Endpoints y campos de respuesta sin secretos (`automation_update`, etc.) |

La base **no** debe mezclarse con lógica comercial específica del producto; el producto **consume** la base, no la reemplaza.

### PRODUCTO Business Assistant

Responsabilidades **del dominio negocio** (futura implementación):

| Área | Descripción |
|------|-------------|
| Perfil del negocio | Nombre, sector, servicios, tono, cliente objetivo, etc. |
| Contexto comercial | Instrucciones y datos que condicionan respuestas del asistente |
| Leads / clientes | Contactos simples asociados al perfil |
| Tareas / follow-ups | Seguimientos derivados de conversaciones, con estado humano |
| Prompts adaptados | Bloque de contexto de negocio inyectado en el system prompt |
| Decisiones comerciales | Siempre con humano en el loop en el MVP |
| Automatizaciones de negocio | Eventos futuros (`lead.detected`, etc.) — **no** en MVP inicial |

**Regla de separación:** el motor conversacional sigue siendo el de la base; el producto añade **datos**, **prompts** y **vistas** de negocio encima, sin duplicar el núcleo de chat.

---

## 3. MVP User

Usuario inicial objetivo:

- **Dueño o gestor** de un pequeño negocio.
- **Profesional independiente** (consultoría, servicios, freelance).
- **Agencia pequeña** con pocos clientes activos.
- **Negocio local o de servicios:** clínica, consulta, academia, estética, gestoría ligera, comercio de servicios, etc.

**Necesidad principal:** organizar conversaciones con clientes o leads, **no perder seguimiento** y obtener ayuda para redactar o planificar próximos pasos, **sin** la complejidad de un CRM enterprise.

**No es usuario objetivo en MVP:** equipos grandes con roles granulares, multi-sede con billing, o industrias que exijan cumplimiento médico/legal/fiscal avanzado desde el día uno.

---

## 4. Core MVP Use Cases

Casos de uso iniciales (orden sugerido de valor):

1. **Registrar perfil básico del negocio** — una vez (o pocas actualizaciones): nombre, descripción, tono, servicios, cliente objetivo.
2. **Chatear con un asistente que conozca ese perfil** — mismo flujo `/chat` de la base, con contexto de negocio inyectado en servidor.
3. **Guardar conversaciones asociadas al negocio** — reutilizar tablas `conversations` / `messages` / `conversation_summaries` de la base; asociación lógica al perfil cuando exista `business_profiles`.
4. **Detectar posibles leads o tareas de seguimiento de forma asistida** — el modelo **sugiere**; el humano **confirma** antes de persistir o automatizar.
5. **Preparar respuestas o próximos pasos** — borradores, listas de acciones, resúmenes; **sin envío externo** en MVP.
6. **Registrar notas internas** — en contactos, tareas o metadatos acotados; no sustituyen el historial de chat.
7. **Dejar eventos preparados para futuras automatizaciones n8n** — diseño de payloads y nombres de evento; **sin activar** flujos de negocio en la primera fase del producto.

---

## 5. Out of Scope For MVP

Queda **explícitamente fuera** del Business Assistant MVP inicial:

| Área | Motivo |
|------|--------|
| CRM completo | Pipeline, oportunidades, scoring, integraciones masivas |
| Facturación y pagos | Billing, suscripciones, facturas |
| Agenda avanzada | Calendarios, recordatorios automáticos externos |
| Campañas masivas | Email/WhatsApp marketing |
| WhatsApp | Canal externo; fase futura |
| Voz | STT/TTS, agentes de voz |
| Multi-tenant complejo | Aislamiento por organización con RLS productivo |
| Roles avanzados | Admin, permisos granulares, equipos |
| Dashboards complejos | Analítica, KPIs, informes |
| IA autónoma | Decisiones o acciones sin confirmación humana |
| Automatizaciones irreversibles | Envíos, borrados, cambios de estado críticos sin humano |
| Integración fiscal/legal | Impuestos, contratos, cumplimiento normativo |
| Manejo médico/diagnóstico | Contenido clínico regulado |
| Datos sensibles sin diseño | PII/PHI sin políticas, retención y minimización definidas |

Si un requisito cae en esta lista, debe tratarse como **roadmap post-MVP**, no como alcance del primer bloque de producto.

---

## 6. Proposed Data Model

**Propuesta inicial de tablas futuras.** No se crean en Supabase ni en `supabase/schema.sql` hasta una fase BUILD dedicada y spec/SQL aparte si aplica.

### `business_profiles`

Perfil comercial único o principal del negocio en el MVP (un perfil lógico por despliegue piloto; multi-perfil queda para iteraciones posteriores).

| Campo | Tipo sugerido | Notas |
|-------|---------------|--------|
| `id` | `uuid`, PK | |
| `name` | `text` | Nombre comercial |
| `industry` | `text`, nullable | Sector o categoría |
| `description` | `text`, nullable | Descripción breve |
| `target_customer` | `text`, nullable | Cliente ideal |
| `tone` | `text`, nullable | p. ej. formal, cercano, técnico |
| `services` | `jsonb` o `text` | Lista simple de servicios/productos |
| `location` | `text`, nullable | Ciudad, zona, remoto |
| `website` | `text`, nullable | URL pública (sin validar en MVP) |
| `metadata` | `jsonb`, default `{}` | Extensiones acotadas |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `contacts`

Leads o clientes simples vinculados al perfil.

| Campo | Tipo sugerido | Notas |
|-------|---------------|--------|
| `id` | `uuid`, PK | |
| `business_profile_id` | `uuid`, FK → `business_profiles.id` | |
| `name` | `text` | |
| `email` | `text`, nullable | |
| `phone` | `text`, nullable | |
| `company` | `text`, nullable | |
| `source` | `text`, nullable | p. ej. chat, manual, referido |
| `status` | `text`, nullable | p. ej. lead, cliente, archivado |
| `notes` | `text`, nullable | Notas internas |
| `metadata` | `jsonb`, default `{}` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

### `follow_up_tasks`

Tareas de seguimiento sugeridas o creadas por el humano.

| Campo | Tipo sugerido | Notas |
|-------|---------------|--------|
| `id` | `uuid`, PK | |
| `business_profile_id` | `uuid`, FK → `business_profiles.id` | |
| `conversation_id` | `uuid`, nullable, FK → `conversations.id` | Origen en chat |
| `contact_id` | `uuid`, nullable, FK → `contacts.id` | |
| `title` | `text` | |
| `description` | `text`, nullable | |
| `status` | `text` | p. ej. pending, done, cancelled |
| `due_at` | `timestamptz`, nullable | |
| `metadata` | `jsonb`, default `{}` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Aclaración:** estas tablas son **diseño propuesto**. No existen en el repositorio del producto en el momento de esta SPEC. Las tablas conversacionales actuales (`conversations`, `messages`, `conversation_summaries`) **pertenecen a la base** y se reutilizan.

---

## 7. Conversation Behavior

Comportamiento esperado del asistente de producto (sobre el motor base):

- **Usar el perfil del negocio** como contexto estable en cada turno (bloque compacto, no historial completo).
- Mantener **tono profesional y útil**, alineado al `tone` del perfil cuando esté definido.
- **No inventar** datos del negocio (horarios, precios, políticas); si faltan, **preguntar** o indicar que no constan en el perfil.
- **Resumir** conversaciones cuando el usuario lo pida o cuando el flujo base actualice `conversation_summaries`.
- **Sugerir próximos pasos** (respuesta al cliente, llamada, email borrador) como texto; **no ejecutarlos**.
- **Proponer tareas o leads** en lenguaje natural; la **persistencia** en `contacts` / `follow_up_tasks` requiere acción o confirmación explícita del humano en implementación futura.
- **No enviar** emails, WhatsApp ni mensajes externos en el MVP.
- **No activar** automatizaciones irreversibles ni webhooks de negocio sin confirmación humana y flags explícitos en fases posteriores.
- Respetar la política de la base: **ventana reciente acotada** + **summary opcional**; nunca reenviar el historial completo al modelo.

---

## 8. Prompt Strategy

Estrategia de composición del prompt por turno (servidor):

1. **System prompt base de la app** — reglas generales del asistente, límites de seguridad, idioma, negativa a inventar datos del negocio.
2. **Business profile context block** — fragmento **compacto** derivado de `business_profiles` (campos acotados en longitud; truncar o resumir en BUILD si hace falta).
3. **Optional conversation summary** — texto de `conversation_summaries` si existe (mismo patrón que la base).
4. **Recent messages** — últimos N mensajes (`CONTEXT_MESSAGE_LIMIT` de la base, p. ej. 6); solo roles `user` / `assistant`.
5. **Current user message** — contenido del turno actual.

**Reglas:**

- **No** enviar historial completo de la conversación al modelo.
- **No** incluir en el prompt: secretos, tokens, URLs de webhooks, payloads de automatización ni datos innecesarios de contactos (minimizar PII en prompt salvo necesidad explícita del turno).
- El bloque de perfil debe ser **estable** entre turnos de la misma sesión de negocio; cambios de perfil se reflejan en el siguiente turno tras persistir.

---

## 9. Automation Strategy

### Eventos de negocio (futuros, diseño)

| Evento | Cuándo (conceptual) | Notas |
|--------|---------------------|--------|
| `business.profile_created` | Tras crear perfil de negocio | Payload mínimo, sin secretos |
| `lead.detected` | Tras confirmación humana de lead | No automático desde modelo solo |
| `follow_up.requested` | Usuario pide seguimiento explícito | |
| `task.created` | Tras crear tarea confirmada | |
| `human_followup_requested` | Escalado explícito a humano | |

### MVP inicial de automatización (producto)

- **Solo se mantiene** el evento genérico de la base: **`conversation.created`** (al crear conversación nueva en `POST /api/chat/turn`).
- **No activar** `message.created` por volumen y coste de ruido en n8n.
- **No crear** flujos n8n de negocio (CRM, Sheets de leads, emails) hasta fases posteriores y SPEC de automatización de producto.
- **Todo evento sensible** (lead, tarea, envío externo) requiere **confirmación humana** y flag de entorno explícito antes de emitir.
- Payloads: **mínimos** (ids, timestamps, títulos genéricos); **sin** contenido de mensajes, historial ni summary en webhooks.

---

## 10. UI Scope

UI mínima **propuesta** para fases futuras (no implementar en esta SPEC):

| Pantalla / zona | Alcance |
|-----------------|--------|
| Chat existente | `/chat` — lista, historial, turnos (base) |
| Business Profile | Panel o formulario simple: editar campos del perfil |
| Contactos / leads | Vista tabla o lista simple; crear/editar básico |
| Follow-ups | Lista simple de tareas con estado y fecha |
| Dashboard | **No** en MVP — sin gráficos ni KPIs complejos |

Principios UI: pocos clics, formularios cortos, coherencia visual con la app en `web/`, sin nuevas dependencias pesadas sin justificación.

---

## 11. Security and Privacy

Reglas obligatorias para implementación futura:

- **No guardar secretos en código**; usar variables de entorno (`.env` / `.env.local` en desarrollo).
- **No exponer** `.env.local` ni su contenido en documentación, logs ni respuestas API.
- **Service role de Supabase solo en servidor**; nunca en cliente ni en bundles públicos.
- **Minimizar datos sensibles en prompts** — no volcar notas clínicas, DNI completos ni datos bancarios al modelo si no es estrictamente necesario.
- **No enviar todo el historial** al modelo (política de la base + producto).
- **Automatizaciones con payload mínimo** — sin PII innecesaria en webhooks n8n.
- Si el producto maneja **datos sensibles** (salud, menores, etc.), definir **políticas de retención, consentimiento y acceso** antes de BUILD, no como añadido posterior.
- Diagnósticos API (`/api/ai/status`, `/api/automations/status`, etc.) solo con flags booleanos o estados genéricos, **sin** URLs reales de webhooks ni secretos.

---

## 12. Implementation Plan

Fases propuestas (**sin ejecutar** en el momento de esta SPEC):

| Fase | Entregable | Notas |
|------|------------|--------|
| **Phase 1** | Business Profile — documento SPEC + schema spec (SQL diseño) | Este documento + spec de columnas/constraints |
| **Phase 2** | Crear tabla `business_profiles` en Supabase | Migración manual o script; VERIFY tables-status |
| **Phase 3** | UI simple para editar perfil de negocio | Formulario en `web/` |
| **Phase 4** | Inyectar perfil en contexto del chat | Extender armado de prompt en servidor |
| **Phase 5** | Contactos / leads (`contacts`) | CRUD mínimo + enlace opcional a conversación |
| **Phase 6** | Tareas de seguimiento (`follow_up_tasks`) | Lista + estados; confirmación humana |
| **Phase 7** | Eventos n8n de negocio **solo tras confirmación** | Flags, payloads acotados, pruebas end-to-end |
| **Phase 8** | Futuro: WhatsApp, voz, dashboards | Fuera del MVP producto inicial |

Cada fase debe seguir **PLAN → SPEC (si aplica) → BUILD → VERIFY** y no mezclar cambios grandes sin revisión.

---

## 13. Verification Criteria

Criterios de aceptación por fase (referencia):

- La aplicación en `web/` **sigue arrancando** (`npm run dev` o equivalente).
- **`npm run lint`** sin errores relevantes introducidos.
- **`npx tsc --noEmit`** OK en TypeScript.
- **`GET /api/supabase/status`** y **`GET /api/supabase/tables-status`** OK cuando corresponda.
- Tablas nuevas **accesibles** desde servidor cuando se creen (diagnóstico de tablas).
- **Chat sigue funcionando**: turno, historial, lista, summary y título automático sin regresiones.
- **No se exponen secretos** en respuestas, logs ni documentación.
- **No se rompe** el contrato conversacional de la base (`reply`, `conversation_id`, `title_update`, `summary_update`, `automation_update`).
- **Separación con `CURSOR.p1`**: cambios de producto viven en `business-assistant-mvp`; la base original permanece congelada.

---

## 14. Current Status

Estado al redactar esta SPEC:

| Elemento | Estado |
|----------|--------|
| Este documento | **Solo SPEC** — artefacto de diseño de producto |
| Implementación Business Assistant | **No iniciada** como producto |
| Tabla `business_profiles` | **No existe** |
| Tabla `contacts` | **No existe** |
| Tabla `follow_up_tasks` | **No existe** |
| Claude / IA | Activo según configuración; **modo stub** si `AI_PROVIDER=stub` |
| n8n / automatizaciones | Desactivadas o limitadas si `AUTOMATIONS_ENABLED=false`; en base activo **`conversation.created`** cuando automatizaciones habilitadas |
| Supabase (base conversacional) | **Configurado** para `conversations`, `messages`, `conversation_summaries` |
| Git | Repositorio del producto con **primer commit limpio** (sin detallar hashes ni remotos en este doc) |
| `web/` | Contiene MVP **base** de chat; **sin** UI de perfil de negocio ni tablas de producto |
| `CURSOR.p1` | Base original **congelada**; no forma parte de este repo de producto |

**Próximo paso recomendado:** Phase 1 — spec detallada de `business_profiles` y diseño SQL (sin aplicar aún en Supabase).

---

## Documentos relacionados (base, no producto)

- `docs/current-state.md` — checkpoint del motor conversacional.
- `docs/how-to-use-this-base.md` — uso de la base vs productos.
- `docs/database-schema.md` — esquema conversacional actual.
- `docs/spec-business-assistant-mvp.md` — spec piloto anterior (puede coexistir; este documento es la **SPEC de producto MVP** unificada solicitada).

---

*Fin de la SPEC — Business Assistant Product MVP.*
