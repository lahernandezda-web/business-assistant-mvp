# Estado actual del MVP base (checkpoint)

Documento de referencia rápida del sistema conversacional en **MVP base** más **Conversation Title MVP** (Chat + Claude + Supabase + historial/lista/contexto + resúmenes + títulos automáticos). Úsalo en futuros chats (Cursor, ChatGPT, etc.) para alinear contexto sin releer todo el repo.

**Stack:** aplicación Next.js en `web/` (App Router). Rutas API bajo `/api/...`. Chat en **`/chat`**.

---

## 1. Qué está implementado (resumen)

| Área | Estado |
|------|--------|
| Chat UI | Página `/chat`, envío de turnos, lista e historial; **header simplificado** (título, **Nueva conversación**, descripción breve, estado de conversación activa); lista reciente con **título + preview + fecha + búsqueda local**; **estado vacío** guiado en la zona de mensajes; **input inferior** para enviar (ver §4.1) |
| Turno de chat | `POST /api/chat/turn` con validación de cuerpo; respuesta incluye **`automation_update`** (diagnóstico seguro de automatización) |
| IA | Claude vía servidor; modo fake/stub según `AI_PROVIDER` |
| Persistencia | Supabase server-side, service role solo en servidor |
| Tablas | `conversations`, `messages`, `conversation_summaries` |
| Historial | Carga completa para UI; no se reenvía todo al modelo |
| Lista | API `GET /api/chat/conversations`; en UI: **`title`** como línea principal, **ID corto** si no hay título, **`last_message_preview`** debajo, fecha/hora a la derecha, **búsqueda local** por título/preview/id sobre la lista ya cargada (§4.1) |
| Contexto al modelo | Ventana reciente (`CONTEXT_MESSAGE_LIMIT = 6`) |
| Resumen | Summary acumulado en BD + ventana; actualización por lotes |
| Títulos automáticos | `conversations.title`; umbral `TITLE_TRIGGER_MESSAGE_COUNT = 4`; contexto inicial `TITLE_CONTEXT_MESSAGE_LIMIT = 4`; `title_update` en `POST /api/chat/turn` |
| Automatización / n8n (base + primer evento real + First Generic Automation MVP) | Cliente `web/lib/automations/*` (`emitConversationCreatedEvent`, etc.); `GET /api/automations/status`; `POST /api/automations/test`; **`test.automation`** verificado contra n8n (HTTP **200**). **`conversation.created`** emitido desde **`POST /api/chat/turn`** solo cuando se **crea** conversación nueva (sin `conversation_id` reutilizable), **después** de persistir conversación + **primer mensaje user**; **no** se reemite en turnos con conversación existente. Payload acotado: `conversation_id`, `created_at`, `title`, `origin` en `data`; envelope con `source`; **sin** contenido de mensajes, historial, summary ni secretos. `createConversation` devuelve `created_at`/`title` para el evento (`web/lib/chat/persistence.ts`). **`automation_update.conversation_created`:** `attempted` / `sent` (sin URL, secret ni payload del webhook). **First Generic Automation MVP (verificado end-to-end):** flujo n8n probado **Webhook → Check Secret → Flatten Data → Save to Google Sheets → Respond Success** (rama no autorizada: Check Secret → Respond Unauthorized). Hoja externa genérica de log (**documento** *CURSOR Automation Log*, pestaña **events**; columnas `occurred_at`, `event`, `conversation_id`, `origin`, `title`, `source`) — **base reutilizable**, no automatización de negocio concreta. **Verificación:** turno sin `conversation_id` → fila en Sheets con `event = conversation.created`, `origin = chat`, `source = cursor-ai-building-system`, UUID real de conversación, `title` vacío/null, `occurred_at` ISO; respuesta con `attempted: true`, `sent: true`; turno con conversación existente → `attempted: false`, `sent: false`; `title_update` y `summary_update` siguen operativos. Ver `docs/spec-automation-integration-mvp.md`, `docs/spec-automation-conversation-created-mvp.md` y `docs/spec-first-generic-automation-mvp.md`. |

**Calidad verificada (último checkpoint):** `npm run lint` sin errores ni warnings; `npx tsc --noEmit` OK; `SYSTEM_PROMPT` alineado con summary + ventana reciente; documentación principal del proyecto actualizada.

---

## 2. Endpoints activos

| Método | Ruta | Propósito |
|--------|------|-----------|
| `GET` | `/api/health` | Salud básica del servicio |
| `GET` | `/api/ai/status` | Diagnóstico seguro del proveedor de IA (sin secretos) |
| `GET` | `/api/supabase/status` | Diagnóstico seguro de conexión/config Supabase |
| `GET` | `/api/supabase/tables-status` | Diagnóstico de tablas esperadas |
| `POST` | `/api/chat/turn` | Un turno: crear/reutilizar conversación → persistir user → si conversación **nueva**, emitir **`conversation.created`** (n8n, no crítico) → contexto + summary → Claude → persistir assistant → título automático → actualizar summary → respuesta con `automation_update` |
| `GET` | `/api/chat/history?conversation_id=<uuid>` | Historial de mensajes de una conversación |
| `GET` | `/api/chat/conversations?limit=20` | Lista de conversaciones recientes (límite por query) |
| `GET` | `/api/automations/status` | Diagnóstico seguro de flags de automatización (sin URL ni secretos) |
| `POST` | `/api/automations/test` | Prueba manual de envío del evento `test.automation` hacia n8n (no integra chat) |

Implementación típica: rutas en `web/app/api/**/route.ts`.

---

## 3. Tablas Supabase (`public`)

- **`conversations`** — metadatos de hilo (id, `title`, timestamps, `metadata`, etc.); el **título automático** se persiste en `title` cuando aplica el Conversation Title MVP.
- **`messages`** — mensajes `user` / `assistant` ligados a `conversation_id`.
- **`conversation_summaries`** — resumen acumulado por conversación (texto + metadatos de progreso según esquema).

Diagnóstico de presencia/esquema: `/api/supabase/tables-status`. Detalle de columnas: ver `docs/database-schema.md`.

---

## 4. Flujo de una conversación (producto)

1. El usuario abre **`/chat`**.
2. Puede iniciar **nueva conversación** (se limpia `conversation_id` en cliente, p. ej. `localStorage`) o **seleccionar** una conversación de la lista.
3. La **lista** se obtiene con `GET /api/chat/conversations?limit=20` (cada ítem incluye `title`, `last_message_preview`, timestamps e `id`).
4. El **historial completo** para pintar la UI viene de `GET /api/chat/history?conversation_id=...` (y/o estado local); sirve para la interfaz, **no** para reenviar todo al modelo.
5. Cada mensaje nuevo se envía con **`POST /api/chat/turn`** (`content` + `conversation_id` opcional).
6. El servidor persiste, emite automatización si aplica (§1 tabla), construye **contexto compacto** + **summary** si existe, llama a Claude y devuelve `reply`, `conversation_id`, **`title_update`**, **`summary_update`** y **`automation_update`** (diagnósticos seguros; el texto del título en lista se ve al refrescar conversaciones).

### 4.1 Chat UI / Conversation List MVP — presentación en la UI (`/chat`)

En **`web/app/chat/page.tsx`**, la página incluye:

- **Header simplificado:** título **Chat**; botón **Nueva conversación** visible y alineado en la parte superior (en pantallas anchas, en la misma fila que el título); debajo, **descripción breve** (menos técnica que en versiones anteriores); a continuación, texto pequeño de **estado de conversación activa** (**«Conversación activa:»** + ID corto en monoespaciado) o **«Sin conversación activa»** si no hay `conversation_id`.
- **Zona de mensajes:** si no hay historial cargado y no está cargando, un **estado vacío** con el mensaje *«Selecciona una conversación o escribe un mensaje para empezar.»*; con mensajes, el render de burbujas se mantiene como en el MVP.
- **Input inferior:** campo de mensaje y botón **Enviar** (misma funcionalidad: disabled/loading según estado).

La lista de **conversaciones recientes** muestra cada fila así:

- **Línea principal:** `conversation.title` (tras `trim`) si existe y no está vacío; si no, **fallback** con **ID corto** (primeros 8 caracteres del UUID + `...`).
- **Debajo:** `last_message_preview` si la API lo devuelve; si no, el texto **«Sin vista previa»**.
- **A la derecha (misma fila en vista ancha):** fecha/hora local derivada de `updated_at`.
- **Búsqueda simple local:** debajo del título de la sección hay un campo **«Buscar conversación...»** que filtra en **cliente** la lista **ya obtenida** con `GET /api/chat/conversations` (sin endpoints nuevos ni consultas Supabase adicionales). El filtro es por subcadena **insensible a mayúsculas** sobre **`title`**, **`last_message_preview`** e **`id`** (UUID completo); si el texto de búsqueda queda vacío tras `trim`, se muestran todas las filas cargadas; si no hay coincidencias, la UI muestra **«No se encontraron conversaciones»**. **No** usa embeddings ni RAG.
- **Selección** y refresco tras enviar mensaje se mantienen como en el MVP de lista; no cambia la lógica de carga ni `localStorage`.

---

## 5. Cómo funciona el contexto enviado a Claude

- **`CONTEXT_MESSAGE_LIMIT = 6`** (definido en `web/lib/chat/persistence.ts`).
- Solo se envían los **últimos N mensajes** de rol `user` / `assistant` en orden reciente (ventana deslizante).
- El **historial completo** permanece en BD y en la UI; **no** se concatena entero en el prompt del modelo.

---

## 6. Conversation Summary MVP

### Tabla

- `public.conversation_summaries` — almacena el resumen acumulado y datos para saber cuánto del hilo ya está “resumido”.

### Persistencia (`web/lib/chat/persistence.ts`)

Funciones relevantes:

- `getConversationSummary`
- `upsertConversationSummary`
- `getMessagesForSummaryBatch`
- `countMessagesForConversation`

### Lógica de resumen (`web/lib/chat/summary.ts`)

Constantes:

- `SUMMARY_TRIGGER_MESSAGE_COUNT = 12` — umbral de mensajes “pendientes” de integrar antes de considerar un ciclo de actualización.
- `SUMMARY_BATCH_SIZE = 8` — cuántos mensajes del hilo se incluyen por ciclo (orden cronológico en el lote).

Funciones:

- `shouldUpdateConversationSummary`
- `buildSummaryPrompt`
- `updateConversationSummaryIfNeeded`

### Comportamiento en `POST /api/chat/turn`

Esta subsección describe el turno completo con foco en **summary**; el orden post-assistant coincide con **§7** (título) y **§8** (flujo detallado). *Tras guardar el user, en conversaciones nuevas puede ejecutarse la emisión `conversation.created` hacia n8n (§8); no forma parte del pipeline del summary.*

1. Guarda mensaje **user**.
2. Carga **mensajes recientes** para contexto (límite 6).
3. Carga **summary** si existe (errores de carga se registran de forma segura; el turno puede continuar sin summary).
4. Llama a Claude con **system prompt**, **summary opcional** y **ventana reciente**.
5. Guarda mensaje **assistant** (si esto falla, el turno no completa con éxito como hoy).
6. **Título (Conversation Title MVP):** se intenta **`generateConversationTitleIfNeeded`**. Es **no crítico**: si falla, el usuario **sigue** teniendo `reply` válido; **`title_update`** solo informa intento/resultado (`attempted`, `updated`), sin texto del título ni errores internos.
7. **Summary (Conversation Summary MVP):** se intenta **`updateConversationSummaryIfNeeded`**. Es **no crítico**: si falla, **el chat no se rompe**; **`summary_update`** informa intento/resultado **sin** exponer el cuerpo del summary.
8. **Respuesta JSON:** `reply`, `conversation_id`, **`title_update`**, **`summary_update`** y **`automation_update`** (diagnósticos mínimos y seguros).

Comportamiento verificado: el modelo puede usar **información llevada solo en el summary** más los últimos 6 mensajes.

---

## 7. Conversation Title MVP

### Campo y API

- **`public.conversations.title`** — título breve generado automáticamente **una vez** por conversación cuando aún estaba vacío/`null` y el hilo alcanza contexto suficiente.
- **`GET /api/chat/conversations`** — devuelve `title` (puede ser `null` en hilos nuevos) y **`last_message_preview`** del último mensaje `user`/`assistant`.

### Persistencia (`web/lib/chat/persistence.ts`)

- `getConversationTitleState`
- `updateConversationTitle`
- `getMessagesForTitleGeneration`

### Lógica de título (`web/lib/chat/title.ts`)

Constantes:

- **`TITLE_TRIGGER_MESSAGE_COUNT = 4`** — mínimo de mensajes totales en el hilo antes de intentar generar título.
- **`TITLE_CONTEXT_MESSAGE_LIMIT = 4`** — primeros mensajes cronológicos `user`/`assistant` enviados al modelo para el título.

Funciones:

- `shouldGenerateConversationTitle`
- `buildConversationTitlePrompt`
- `normalizeGeneratedTitle`
- `generateConversationTitleIfNeeded`

### Comportamiento en `POST /api/chat/turn`

1. Tras guardar el mensaje **assistant** con éxito, se llama a **`generateConversationTitleIfNeeded`** (no crítico: si falla, el usuario sigue recibiendo `reply`).
2. A continuación se ejecuta **`updateConversationSummaryIfNeeded`** (orden: título → summary).
3. La respuesta incluye **`title_update`**: `{ "attempted": true, "updated": boolean }` sin prompt, sin mensajes usados ni errores internos; el turno también devuelve **`automation_update`** (ver §8). Opcionalmente la UI refresca la lista para leer el `title` persistido.

**Spec de referencia:** `docs/spec-conversation-title-mvp.md`.

---

## 8. Flujo detallado de `POST /api/chat/turn`

Orden lógico actual (implementado en `web/app/api/chat/turn/route.ts` + motor en `web/lib/chat/chat-engine.ts`):

1. **Leer JSON** del body.
2. **Validar** `content` y `conversation_id` opcional (`validateChatTurnBody`).
3. **Si no hay `conversation_id`:** crear conversación (`createConversation`).
4. **Si hay `conversation_id`:** verificar que exista (`getConversation`); si no existe → 404 coherente con mensajes de error del chat.
5. **Guardar** mensaje **user** (`saveMessage`).
6. **Si** la conversación es **nueva** en este turno: intentar emitir **`conversation.created`** vía `emitConversationCreatedEvent` (no crítico; fallos de n8n **no** impiden el resto del turno). La respuesta incluye **`automation_update.conversation_created`** (`attempted`, `sent`).
7. **Cargar** últimos mensajes para contexto (`getRecentMessagesForContext` con `CONTEXT_MESSAGE_LIMIT`).
8. **Cargar** summary acumulado si existe (`getConversationSummary`); opcional en el payload a Claude.
9. **Llamar a Claude** (`handleChatTurn`): system prompt + summary opcional + mensajes de contexto recientes.
10. **Guardar** mensaje **assistant**.
11. **Intentar** `generateConversationTitleIfNeeded` (errores absorbidos; `title_update` refleja intento/resultado).
12. **Intentar** `updateConversationSummaryIfNeeded` (errores absorbidos; `summary_update` refleja intento/resultado).
13. **Responder** con `reply`, `conversation_id`, `title_update`, `summary_update`, `automation_update`.

---

## 9. Variables de entorno relevantes (sin valores)

- **`ANTHROPIC_API_KEY`** — solo servidor; nunca en cliente.
- **`ANTHROPIC_MODEL`** — modelo Claude.
- **`AI_PROVIDER`** — selección de proveedor real vs fake/stub cuando aplique.
- Supabase: URL y claves de servicio según convención del proyecto (solo servidor). Ver `.env.example` (sin secretos reales).
- **Automatización / n8n:** `AUTOMATIONS_ENABLED`, `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET` — placeholders en `web/.env.example` (y raíz); valores reales solo en `web/.env.local` (no versionado). Cliente en `web/lib/automations/*`; **`conversation.created`** desde `POST /api/chat/turn` cuando hay conversación nueva (ver specs). **`N8N_WEBHOOK_SECRET`** solo servidor. Conectividad **`test.automation`**, evento **`conversation.created`** y **First Generic Automation MVP** (registro genérico en **Google Sheets** vía n8n) verificados en local; **no** documentar URL de webhook ni valores de secret en el repo.

Estado/diagnóstico: `/api/ai/status`, `/api/supabase/status`, `/api/automations/status`.

---

## 10. Qué **no** está implementado todavía

Explícitamente **fuera** del alcance actual del producto documentado aquí:

- Autenticación de usuarios
- Multi-tenant real
- RLS por usuario/tenant
- WhatsApp Cloud API
- Evento **`message.created`** u otros eventos de automatización más allá de **`conversation.created`**
- Automatización de **negocio** concreta en n8n (CRM, leads, verticales; el **log genérico** en Sheets vía `conversation.created` ya está verificado como base, no sustituye producto vertical)
- Voz (ElevenLabs, Vapi, Retell, Realtime, etc.)
- Embeddings
- RAG
- Tool calling
- Streaming de respuestas
- Panel de administración
- Gestión de usuarios
- Facturación
- SaaS multiempresa completo
- Edición manual o regeneración explícita de títulos de conversación
- Búsqueda **server-side**, indexada o paginada cuando el volumen de conversaciones supere el listado en cliente (la UI ya incluye **búsqueda local** sobre la página de resultados de `GET /api/chat/conversations`)

---

## 11. Reglas del proyecto (operativas)

- **No tocar** `.env.local` en commits ni compartir su contenido.
- **No exponer** API keys, tokens ni contraseñas en código, logs o respuestas API.
- **Claude solo desde servidor** (API routes / servidor Next).
- **Supabase service role solo desde servidor**; nunca en el navegador.
- **No enviar** el historial completo a Claude; mantener **contexto compacto** (ventana + summary).
- Avanzar en **bloques pequeños**; metodología: **PLAN → SPEC → BUILD → VERIFY**.
- Evitar sobreingeniería; **no** instalar dependencias innecesarias.
- **No** Docker ni microservicios salvo necesidad real.
- **No** refactorizar grandes partes sin permiso explícito.

---

## 12. Próximas fases recomendadas (orden sugerido)

1. **Diseño responsive** más pulido del panel de chat y de la lista, u otros layouts (p. ej. sidebar dedicado), **después** de la pulida básica de estructura visual ya aplicada en `/chat` (sin cambiar contratos API).
2. Edición manual de títulos (si el producto lo requiere)
3. Búsqueda **server-side** o paginación de conversaciones si el volumen crece (la **búsqueda local** en lista ya está en `/chat`)
4. Auth básica con Supabase
5. Multi-tenant (`tenants`, `tenant_members`, etc.) + **RLS**
6. **`message.created`** u otros eventos hacia n8n; workflows de negocio en n8n más allá del log genérico en Sheets y el webhook que consume `conversation.created`
7. WhatsApp Cloud API
8. Voz (fase posterior)
9. Mini app SaaS de prueba reutilizando el mismo motor conversacional

---

## 13. Documentos relacionados

Para profundizar: `docs/architecture.md`, `docs/api-endpoints.md`, `docs/database-schema.md`, `docs/conversation-memory.md`, especs por MVP en `docs/spec-*.md`, `docs/roadmap.md`.

---

*Última actualización de este checkpoint: lo anterior + **`conversation.created`** integrado en `POST /api/chat/turn` con `automation_update` + **First Generic Automation MVP** verificado end-to-end (**app → n8n → Google Sheets**, log genérico en hoja *events*), sin documentar URL de webhook ni secret.*
