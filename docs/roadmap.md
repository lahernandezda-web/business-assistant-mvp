# Roadmap (MVP por fases)

Orden deliberado: **validar el núcleo conversacional en web** antes de canales y automatización externa. Cada fase debe ser desplegable y útil por sí sola.

El **núcleo conversacional en web con Claude en servidor**, el **MVP de persistencia Supabase** (conversaciones y mensajes por turno), el **Conversation Summary MVP** (tabla `conversation_summaries`, contexto summary + ventana reciente), el **Conversation Title MVP** (`conversations.title`, generación automática tras contexto inicial, `title_update` en el turno), la **mejora básica de UI del listado** en `/chat` (`title` + `last_message_preview`, fallback a ID corto) y la **búsqueda simple local** en esa lista (filtro en cliente por título, preview e `id`, sin endpoints nuevos), más la **pulida visual básica de `/chat`** (header simplificado, botón Nueva conversación, estado de conversación activa, estado vacío de mensajes, espaciados en lista e input), y la **automatización hacia n8n** (`test.automation` + **`conversation.created`** desde `POST /api/chat/turn` verificados en local contra webhook real, con `automation_update` en la respuesta), más el **First Generic Automation MVP** (**`conversation.created` → n8n → Google Sheets**, log externo genérico verificado end-to-end), ya están entregados; el detalle de hitos figura en las secciones siguientes.

## Completed: Chat MVP + Claude Provider

- Scaffold de **Next.js** bajo `web/`.
- **UI mínima de chat** en `/chat` conectada al BFF.
- **`POST /api/chat/turn`**: contrato de turno y respuesta del asistente.
- **Validación de input** del cuerpo JSON (errores controlados).
- **`chat-engine`** interno con **system prompt** mínimo de contexto del proyecto.
- **Capa de proveedor IA** separada (`get-provider`, tipos compartidos).
- **`fake-provider`** como modo seguro por defecto (`AI_PROVIDER=stub` u omitido / valor desconocido).
- **`claude-provider`** con **`@anthropic-ai/sdk`** y llamadas solo en servidor (`AI_PROVIDER=claude`).
- Claves solo en **entorno del host** (p. ej. `web/.env.local` fuera del repositorio).
- **`GET /api/ai/status`**: diagnóstico seguro (`provider`, `model`, `has_api_key`) sin exponer la API key.

## Completed: Supabase Persistence MVP

- Supabase project configured.
- Environment variables added to `web/.env.local`.
- `@supabase/supabase-js` installed.
- Server-side Supabase client created (`web/lib/supabase/server.ts`).
- Safe status endpoint created (`GET /api/supabase/status`).
- Tables-status endpoint created (`GET /api/supabase/tables-status`).
- `supabase/schema.sql` created and executed.
- `conversations` table created.
- `messages` table created.
- Chat persistence layer created (`web/lib/chat/persistence.ts`).
- During development, `POST /api/supabase/persistence-test` was used as an internal diagnostic to insert test rows via `persistence.ts`; **removed** after verification so accidental test writes are not exposed. Real persistence is **`POST /api/chat/turn`** only.
- `POST /api/chat/turn` now creates/reuses conversations.
- User and assistant messages are persisted.
- `/chat` stores and reuses `conversation_id`.

## Completed: Conversation History MVP

- `GET /api/chat/history` implemented.
- `getMessagesForConversation()` added to persistence layer.
- Messages are loaded from Supabase by `conversation_id`.
- Messages are returned ordered by `created_at`.
- Default history limit is 50 messages, max 100.
- `/chat` stores `conversation_id` in `localStorage`.
- `/chat` reloads previous messages after page refresh.
- `/chat` can start a new conversation.
- `/chat` displays a short active conversation identifier.
- History is shown in UI only.
- Claude does not receive full conversation history yet.

## Completed: Conversation List MVP

- `GET /api/chat/conversations` implemented.
- `getRecentConversations()` added to persistence layer.
- Recent conversations are ordered by `updated_at` desc.
- Default limit is 20, max 50.
- `/chat` loads recent conversations on mount.
- `/chat` displays a simple recent conversation list.
- **`web/app/chat/page.tsx`:** línea principal con **`title`** (si existe y no está vacío tras `trim`); si no, **fallback** con **ID corto** (8 caracteres + `...`); debajo **`last_message_preview`** o **«Sin vista previa»**; **fecha/hora** a la derecha (`updated_at`); títulos largos con **truncate** + `title` nativo para ver el texto completo; **búsqueda local** con input **«Buscar conversación...»** que filtra en cliente (sin llamadas extra al backend) por **`title`**, **`last_message_preview`** e **`id`** (subcadena, sin distinguir mayúsculas); mensaje **«No se encontraron conversaciones»** si el filtro no coincide; **sin** embeddings ni RAG; selección y refresco tras envío sin cambios de contrato.
- `/chat` allows selecting a previous conversation.
- Selected conversation history is loaded through `GET /api/chat/history`.
- "Nueva conversación" clears active state and `localStorage`.
- Conversation list refreshes after sending a message.

## Completed: /chat UI polish (básico)

- **Header:** título **Chat** visible; botón **Nueva conversación** alineado en la parte superior (misma fila que el título en vista ancha); descripción breve y menos técnica; texto pequeño de **conversación activa** (ID corto) o **Sin conversación activa**.
- **Lista y buscador:** sin cambio de contrato; se mantiene **title** / **ID corto**, **preview**, **fecha**, búsqueda local y selección; espaciados refinados en la sección.
- **Zona de mensajes:** estado vacío con *«Selecciona una conversación o escribe un mensaje para empezar.»* cuando no hay historial que mostrar (salvo carga).
- **Input inferior** y **Enviar:** misma funcionalidad (disabled/loading según estado).
- Implementación acotada a **`web/app/chat/page.tsx`**; sin cambios en backend, Supabase ni lógica de summaries/títulos.

## Completed: Conversation Context MVP

- `CONTEXT_MESSAGE_LIMIT = 6` defined.
- `getRecentMessagesForContext()` added to persistence layer.
- Recent messages are loaded from Supabase before calling Claude.
- Only `role` and `content` are sent to the AI provider.
- `ids`, `timestamps` and `metadata` are not sent to Claude.
- `chat-engine` accepts `context_messages`.
- `/api/chat/turn` loads limited context after saving the user message.
- Claude can answer using recent conversation context.
- Full history is still not sent to Claude.
- Advanced memory beyond accumulated summary + recent window remains out of scope.

## Completed: Conversation Summary MVP

- **Tabla** `public.conversation_summaries` en Supabase (alineada con `supabase/schema.sql`); `GET /api/supabase/tables-status` puede exponer `conversation_summaries_accessible: true` cuando el proyecto tiene la tabla.
- **Persistencia:** `getConversationSummary`, `upsertConversationSummary`, `getMessagesForSummaryBatch`, `countMessagesForConversation` en `web/lib/chat/persistence.ts`.
- **Módulo** `web/lib/chat/summary.ts` con `SUMMARY_TRIGGER_MESSAGE_COUNT = 12`, `SUMMARY_BATCH_SIZE = 8`, `shouldUpdateConversationSummary`, `buildSummaryPrompt`, `updateConversationSummaryIfNeeded`.
- **Orquestación:** `POST /api/chat/turn` carga el summary si existe (texto no vacío), pasa **summary + ventana reciente** al motor; tras guardar el **assistant** intenta `updateConversationSummaryIfNeeded`; si falla la actualización del summary, **el chat no se rompe**.
- **Respuesta API:** `summary_update` (`attempted`, `updated`) en la misma respuesta que `reply` y `conversation_id`; **no** incluye el texto del summary.
- **Modelo en cada turno:** **system prompt** + **summary acumulado** (si existe y no está vacío) + hasta **6** mensajes `user`/`assistant` recientes (**`CONTEXT_MESSAGE_LIMIT = 6`**, sin cambio); **no** historial completo; **sin** embeddings ni RAG.
- **Spec de referencia:** `docs/spec-conversation-summary-mvp.md` (ahora reflejada en código como MVP).

## Completed: Conversation Title MVP

- **Campo** `title` en `public.conversations` (ya en esquema); generación **solo** si estaba vacío/`null` y el hilo tiene al menos **4** mensajes (`TITLE_TRIGGER_MESSAGE_COUNT = 4`).
- **Persistencia:** `getConversationTitleState`, `updateConversationTitle`, `getMessagesForTitleGeneration` en `web/lib/chat/persistence.ts`.
- **Módulo** `web/lib/chat/title.ts` con `TITLE_CONTEXT_MESSAGE_LIMIT = 4`, `shouldGenerateConversationTitle`, `buildConversationTitlePrompt`, `normalizeGeneratedTitle`, `generateConversationTitleIfNeeded`.
- **Orquestación:** `POST /api/chat/turn` tras guardar el **assistant** llama a `generateConversationTitleIfNeeded` y luego a `updateConversationSummaryIfNeeded`; si falla el título, **el chat no se rompe** y el summary sigue intentándose.
- **Respuesta API:** `title_update` (`attempted`, `updated`) junto a `reply`, `conversation_id`, `summary_update` y **`automation_update`**; **no** incluye el texto del título, el prompt ni los mensajes usados (la lista se refresca vía `GET /api/chat/conversations`).
- **Lista:** `GET /api/chat/conversations` devuelve `title` y `last_message_preview` por conversación.
- **Spec de referencia:** `docs/spec-conversation-title-mvp.md` (implementada en MVP; ver sección *Implementation Status* en ese documento).

## Completed: Automation Integration Base MVP — test.automation connectivity

- Placeholders en **`.env.example`** y **`web/.env.example`**: `AUTOMATIONS_ENABLED`, `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` (sin valores reales en el repo).
- **Cliente server-side:** `web/lib/automations/types.ts`, `events.ts`, `client.ts` (`createAutomationEvent`, `sendAutomationEvent`, `getAutomationServerStatus`).
- **`GET /api/automations/status`:** diagnóstico solo con booleanos (sin URL ni secret en la respuesta).
- **`POST /api/automations/test`:** envía el evento `test.automation` a n8n para prueba manual; respuesta JSON segura (`sent`, `status` / `error`); **no** lee body del cliente.
- **Verificación real (local):** con variables configuradas **solo** en `web/.env.local` (fuera de Git), se comprobó `configured: true` en status y **`sent: true`**, **`status: 200`** en el test; confirma conectividad **app → webhook n8n**. No se documentan aquí URL ni secret.
- **Cadena verificada:** `test.automation` → **`conversation.created`** desde el chat → **First Generic Automation MVP** (Google Sheets); ver secciones **Completed** siguientes en este roadmap.

## Completed: Automation Integration Base MVP — conversation.created event

- **Spec:** `docs/spec-automation-conversation-created-mvp.md`.
- **Helper:** `emitConversationCreatedEvent` en `web/lib/automations/events.ts` (tipo `EmitConversationCreatedEventInput` en `types.ts`).
- **`POST /api/chat/turn`:** emite **`conversation.created`** solo cuando se crea conversación **nueva** (sin `conversation_id` reutilizable), **después** de persistir la conversación y el **primer mensaje user**; no se reemite en turnos con conversación existente.
- **`createConversation`** devuelve `created_at` y `title` para alimentar el payload del evento (`web/lib/chat/persistence.ts`).
- **Respuesta del turno:** incluye **`automation_update.conversation_created`** con `{ "attempted": boolean, "sent": boolean }` (sin URL, secret ni payload del webhook).
- **Verificación real (local):** turno **sin** `conversation_id` → `attempted: true`, `sent: true` con n8n en 200; turno **con** el mismo `conversation_id` → `attempted: false`, `sent: false`; **`title_update`** y **`summary_update`** se mantienen.

## Completed: First Generic Automation MVP — conversation.created to Google Sheets

- **Spec:** `docs/spec-first-generic-automation-mvp.md` (diseño + **Implementation Status** con verificación Sheets).
- **Objetivo:** primer flujo **genérico** (no vertical de negocio): registrar eventos reales en un **log externo** reutilizable.
- **Workflow n8n verificado (rama éxito):** **Webhook** → **Check Secret** → **Flatten Data** → **Save to Google Sheets** → **Respond Success**. **Rama false:** Check Secret → **Respond Unauthorized**.
- **Google Sheet (log):** documento **CURSOR Automation Log**, pestaña **events**; columnas `occurred_at`, `event`, `conversation_id`, `origin`, `title`, `source` (mapeo desde payload + envelope; **no** se documentan URL de webhook ni secretos en el repo).
- **Prueba end-to-end:** `POST /api/chat/turn` sin `conversation_id` con mensaje de prueba → `automation_update.conversation_created.attempted = true`, `sent = true` → fila en Sheets con `event = conversation.created`, UUID real de conversación, `origin = chat`, `source = cursor-ai-building-system`, `title` vacío/null, `occurred_at` ISO. **Sin** mensajes, historial, summary ni secrets en el payload hacia n8n (política de la base de automatización).

## Next Recommended Phase (mejoras y canales)

Prioridades típicas **después** del núcleo conversacional + summaries + títulos + **listado con título, preview y búsqueda local en UI** + **pulida visual básica de `/chat`** + **automatización base n8n** (`test.automation` + **`conversation.created`** desde el turno, verificados en local) + **First Generic Automation MVP** (Sheets):

- **Automatización (siguiente):** evento **`message.created`** si se necesita más granularidad; **`human_followup_requested`** u otros eventos según producto; workflows n8n de **negocio** (CRM, alertas, etc.) reutilizando los webhooks ya probados.
- **Edición manual** o regeneración de títulos cuando el producto lo requiera.
- **Búsqueda server-side** o paginación cuando haya muchas conversaciones (el listado actual se limita en API y la UI ya filtra en cliente sobre esa página).
- **Mejoras de UI más avanzadas** (la estructura visual básica del header, estado vacío y lista en `/chat` ya está entregada): diseño **responsive** más pulido, layout tipo **sidebar** real, mejor **navegación** entre hilos, etc. — todo sin cambiar contratos API salvo que se documente otro hito.
- **Auth básica** con Supabase y, más adelante, **multi-tenant / RLS** cuando el producto lo requiera.
- **WhatsApp Cloud API** y ampliación de **n8n** (el hito **conversation.created** desde el chat y el **log genérico en Google Sheets** ya están verificados; siguen flujos de negocio avanzados, producción con URL de webhook definitiva si hoy se usa solo entorno de prueba, y más eventos si aplica).
- **Voz** (STT/TTS, agentes de voz) reutilizando el mismo motor.
- **Mini app SaaS de prueba** reutilizando el mismo motor conversacional.
- **Business Assistant** y otras specs de producto avanzado (`docs/spec-business-assistant-mvp.md`, etc.) cuando se prioricen.
- **Robustez futura** en automatización: retries, logs internos más ricos, colas / DLQ, fire-and-forget u otros patrones cuando el tráfico o el equipo lo exijan.
- **Calidad de código (estado actual):** en `web/`, **`npm run lint`** y **`npx tsc --noEmit`** están **limpios**; no hay deuda documentada como bloqueante en esa línea. Cualquier ajuste futuro de reglas ESLint, estilo o refino cosmético en archivos heredados sería **mejora opcional**, no pendiente actual que impida continuar.

## Fase 1 — Web chat básico

**Estado: completada** (véase la sección **Completed: Chat MVP + Claude Provider** más arriba).

- UI mínima de chat en Next.js.
- Un endpoint servidor que reciba mensajes y devuelva respuestas usando **Claude API** (sin exponer claves al cliente).
- Sin persistencia compleja: opcionalmente estado en memoria o archivo solo para desarrollo; el objetivo es **probar el contrato de turno** y la política de tokens.

**Criterio de hecho:** conversación funcional en navegador con latencia y UX aceptables.

## Fase 2 — Supabase

- Proyecto Supabase: tablas para **conversaciones**, **mensajes**, **tenants** (o proyectos) y usuarios vinculados a auth.
- **Row Level Security** por `user_id` / `tenant_id`.
- Persistir cada turno y metadatos de uso (tokens, modelo) según `docs/token-cost-policy.md`.
- **Resumen + ventana** de historial para no crecer el contexto sin límite.

**Criterio de hecho:** recargar la página y recuperar historial; datos aislados por tenant.

## Fase 3 — WhatsApp Cloud API

- Webhook dedicado para Meta; verificación de desafío y firma de payloads según documentación actual de Meta.
- **Adaptador** que normalice mensajes entrantes al contrato interno del motor.
- Envío de respuestas por la API de WhatsApp.
- Mapeo `wa_id` / thread ↔ `conversation_id` interno en Supabase.

**Criterio de hecho:** el mismo motor atiende web y WhatsApp con persistencia unificada.

## Fase 4 — n8n

**Estado:** conectividad base + **`conversation.created`** desde `POST /api/chat/turn` verificados en local; **First Generic Automation MVP** (**app → n8n → Google Sheets**) verificado como **log externo genérico**. **Pendiente:** ampliar con más eventos (`message.created`, etc.), flujos n8n de **negocio** productivos, despliegue con webhook/URL de **producción** cuando deje de bastar el entorno de prueba, y robustez (retries, colas, etc.).

- Flujos n8n para integraciones (CRM, alertas, tareas batch, aprobaciones humanas).
- Webhooks **autenticados** entre n8n y la app; n8n actualiza Supabase o dispara acciones acotadas.
- Límites claros: n8n **no** sustituye al modelo como cerebro del chat salvo casos excepcionales documentados.

**Criterio de hecho (fase ampliada):** al menos un flujo productivo (p. ej. notificación o sync de datos) conectado sin romper el núcleo; el criterio mínimo de **tubo de prueba** (`test.automation` → 200), el primer evento desde chat (**`conversation.created`**) y el **log genérico en Google Sheets** (**First Generic Automation MVP**, app → n8n → Sheets) ya se cumplieron en entorno local.

## Fase 5 — Agentes de voz

- Contrato de canal de voz: STT → texto → motor → texto → TTS.
- Ajustes de política de tokens/latencia para conversación hablada.
- Elección de proveedor(es) de STT/TTS (p. ej. ElevenLabs, Vapi, Retell, OpenAI Realtime) según coste y requisitos del negocio.

**Criterio de hecho:** un flujo de voz end-to-end reutilizando el mismo motor y persistencia que web/WhatsApp.

## Notas

- Entre fases se puede **pausar** y estabilizar observabilidad y costes antes de añadir canales.
- No se requiere Docker ni Redis en las fases iniciales; reevaluar con métricas reales de tráfico y equipo.

## Documentación relacionada

- `docs/project-brief.md` — objetivo y stack.
- `docs/architecture.md` — flujo y adaptadores.
- `docs/token-cost-policy.md` — reglas de coste con Claude.
