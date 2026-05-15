# Chat MVP Specification

## 1. Objective

El **Chat MVP** es el flujo conversacional mínimo dentro de la app **Next.js** (`web/`), con **Route Handlers** como capa BFF en el servidor. En el estado **actual del repositorio** ya incluye: motor conversacional conectado al endpoint de turno, **Claude solo desde servidor**, **persistencia en Supabase** para conversaciones y mensajes, y **contexto compacto** (resumen opcional + ventana de mensajes recientes), alineado con `docs/token-cost-policy.md` y `docs/conversation-memory.md`.

Este documento fija el **alcance y contrato del núcleo de chat** en su forma entregada; el detalle de summaries, títulos, listado con previews, automatización hacia n8n y demás hitos posteriores vive en **roadmap** y en las **specs dedicadas** enlazadas al final.

## 2. Current status

En el repositorio existen, bajo `web/`:

| Ruta | Rol |
|------|-----|
| `web/app/page.tsx` | Landing mínima del proyecto |
| `web/app/chat/page.tsx` | UI de chat funcional (mensajes, envío al BFF, historial y lista de conversaciones según hitos entregados; detalle de UX en roadmap y specs posteriores) |
| `web/app/api/health/route.ts` | `GET /api/health` — comprobación de vida del BFF |
| `web/app/api/chat/turn/route.ts` | `POST /api/chat/turn` — **conectado al motor conversacional** (Claude en servidor cuando está configurado el proveedor; persistencia Supabase; actualizaciones de título, summary y automatización según orquestación documentada en otras specs) |

Comportamiento **actual** resumido:

- **`/chat`** existe y funciona como **UI básica** operativa.
- **`POST /api/chat/turn`** existe y está **conectado al motor conversacional** (no es una respuesta fija de stub).
- **Claude** se invoca **solo desde el servidor** (nunca desde el cliente).
- **Validación del body:** `content` obligatorio, tipo `string`, **no vacío** tras `trim`; **`conversation_id` opcional** (string identificador de conversación existente cuando el cliente reutiliza un hilo).
- **Sin `conversation_id` válido para reutilizar:** se **crea una conversación nueva** y se devuelve su identificador en la respuesta.
- **Con `conversation_id` válido:** se **reutiliza** esa conversación para el turno.
- Los mensajes **user** y **assistant** del turno se **persisten en Supabase**.
- La respuesta exitosa incluye al menos: **`reply`**, **`conversation_id`**, **`title_update`**, **`summary_update`** y **`automation_update`** (estructura acorde a la implementación; sin exponer secretos ni payloads sensibles hacia el cliente).
- **No** se envía el **historial completo** a Claude; el **contexto** enviado al modelo usa **summary opcional** (si existe en persistencia) **más los últimos mensajes recientes** dentro de los límites definidos en el proyecto.
- **Historial en UI**, **lista de conversaciones**, **previews**, **títulos automáticos** y **summary acumulado** están **implementados** y descritos en el **roadmap** y en specs posteriores (p. ej. historial, listado, summary MVP, title MVP, automatización); este documento no duplica esos contratos al detalle.

## 3. Initial MVP / historical note

En una **fase inicial** del proyecto, `POST /api/chat/turn` respondía con un **stub** (mensaje fijo, **`conversation_id: null`**, sin Claude ni Supabase). Ese contrato y ese alcance **ya no describen el estado actual**. Se conserva esta nota solo como **referencia histórica**; las secciones **2**, **4**, **5** y siguientes reflejan el comportamiento **vigente**.

## 4. User flow

1. El usuario escribe un mensaje en **`/chat`**.
2. El frontend envía **`POST /api/chat/turn`** con JSON que incluye **`content`** y, si aplica, **`conversation_id`** para continuar un hilo.
3. El **Route Handler** valida el body; los errores devuelven **400** con JSON de error controlado cuando corresponda.
4. El handler delega en el **motor conversacional**: persistencia del mensaje de usuario, construcción de **contexto compacto**, llamada al **proveedor de IA en servidor**, persistencia de la respuesta del asistente, y pasos posteriores (título, summary, automatización) según la orquestación del proyecto.
5. La respuesta JSON incluye la respuesta del asistente, el identificador de conversación y los campos de actualización mencionados en la sección 5.
6. El cliente actualiza la UI y, según las capacidades entregadas, sincroniza lista de conversaciones e historial vía los endpoints documentados en el roadmap (p. ej. `GET /api/chat/history`, `GET /api/chat/conversations`).

## 5. Endpoint contract

### `POST /api/chat/turn`

**Request body:**

```json
{
  "content": "mensaje del usuario",
  "conversation_id": "opcional-id-conversacion-existente"
}
```

- **`content`:** obligatorio; **`string`** no vacío (tras `trim`).
- **`conversation_id`:** opcional; cuando se envía y es válido para el almacén, el turno se asocia a esa conversación; si no se envía o no aplica reutilización coherente, se crea o selecciona conversación según la lógica del servidor (el cliente recibe siempre un **`conversation_id`** explícito en éxito).

**Response body (éxito, forma lógica):**

```json
{
  "reply": "texto de respuesta del asistente",
  "conversation_id": "id-de-la-conversacion-del-turno",
  "title_update": {},
  "summary_update": {},
  "automation_update": {}
}
```

Los objetos `title_update`, `summary_update` y `automation_update` siguen la forma acordada en el código y en las specs de **Conversation Title**, **Conversation Summary** y **Automation** (p. ej. flags del tipo `attempted` / `updated` / `sent` sin incluir secretos, URL de webhook ni textos internos que no deban exponerse).

**Errores (status `400`, JSON con campo `error` descriptivo):**

- Cuerpo no es JSON válido.
- Cuerpo no es un objeto JSON.
- Falta el campo `content` o **no es de tipo `string`**.
- **`content` vacío o solo espacios** (tras `trim`): el handler rechaza con **400** y mensaje `content cannot be empty` (u equivalente alineado con la implementación).

En todos los casos de error: **`400`** y un mensaje de error **controlado** (sin filtrar stack traces ni datos sensibles).

## 6. Frontend responsibilities

El frontend (`/chat`) debe:

- Enviar turnos a **`/api/chat/turn`** con `Content-Type: application/json` y el contrato de la sección 5.
- **Renderizar** mensajes del usuario y del asistente, y **mostrar errores** de forma simple cuando la API falle.
- **No** manejar claves API ni secretos en el navegador.
- **No** llamar directamente a Claude ni a otros proveedores de IA desde el cliente.

La **lista de conversaciones**, **carga de historial**, **previews**, **títulos** y **summaries** en UI y su relación con otros endpoints se documentan en **`docs/roadmap.md`** y en las specs específicas (historial, listado, summary, título, etc.).

## 7. Backend responsibilities

El Route Handler de `/api/chat/turn` debe:

- **Recibir** el mensaje en JSON y **validar** la entrada según la sección 5.
- **Responder** siempre en JSON coherente con el contrato (éxito o error).
- Mantener **Claude (u otro proveedor) solo en servidor** y **no exponer** secretos en respuestas ni logs innecesarios.
- Orquestar **persistencia**, **contexto compacto** y **proveedor de IA** de forma modular (véase `docs/architecture.md`).

## 8. Chat engine, context and persistence

- Existe capa de **motor / proveedor IA** bajo `web/lib/chat/` y `web/lib/ai/` (validación de input, motor de turno, proveedor configurable). El modo seguro por defecto y las variables de entorno se describen en **`web/.env.example`** y en el roadmap; **no** se documentan aquí valores reales ni claves.
- **Supabase** está **integrado** para conversaciones y mensajes del flujo de chat (véase `docs/roadmap.md` — *Supabase Persistence MVP* — y `docs/database-schema.md`). **RLS**, **auth de producto** y **multi-tenant** pueden ser fases posteriores según producto.
- El motor construye **contexto mínimo** para el modelo: **no** historial completo; **summary** cuando exista + **últimos N mensajes** recientes, en línea con `docs/conversation-memory.md` y `docs/token-cost-policy.md`.
- Incluye **system prompt** de contexto del proyecto (acotado); prioriza respuestas breves y controladas salvo petición contraria.

## 9. Token cost policy alignment

- **No** enviar al modelo el **historial completo** ni documentación masiva en cada turno.
- Usar **summaries** en base de datos para hilos largos cuando el flujo de summary esté activo.
- Enviar al modelo solo lo necesario: **system** estable y acotado, **summary** (si existe), **últimos N mensajes** y políticas acordadas en `docs/token-cost-policy.md`.
- Fomentar **conversaciones acotadas** y **hilos por tema** cuando el producto lo permita.

## 10. Out of scope (para este documento como spec del núcleo)

Este spec del **Chat MVP** no sustituye la documentación de:

- **Autenticación** de usuario final y **tenants** reales en producción (pueden ser fases posteriores).
- **WhatsApp Cloud API**, **voz** y otros canales.
- **n8n** y flujos de negocio avanzados (la **base** de automatización y el primer flujo genérico están en roadmap y specs de automatización).
- **Docker**, **Redis** u orquestación infra obligatoria para el MVP descrito aquí.
- **Nuevas dependencias** npm salvo decisión explícita del proyecto.

Queda **fuera** de lo que este archivo debe detallar: cualquier **secreto** (API keys, URL de webhook, tokens); el lector debe usar solo **variables de entorno** y archivos de ejemplo sin valores reales, según `AGENTS.md`.

## 11. Verification criteria

Este bloque documental se considera **alineado** con el repositorio si:

- `web/AGENTS.md` remite de forma clara a **`../AGENTS.md`** y refuerza las restricciones del proyecto.
- Existe **`docs/spec-chat-mvp.md`** describiendo el **estado actual** del núcleo (UI `/chat`, turno conectado, Claude en servidor, validación, persistencia, respuesta con `title_update` / `summary_update` / `automation_update`, contexto compacto).
- **No** se documentan claves reales, URL de webhooks ni secretos.
- Las capacidades añadidas después del núcleo (historial, lista, summaries, títulos, automatización) siguen referenciadas en **roadmap** y specs dedicadas sin contradicción con este contrato base.

## Documentación relacionada

- `../AGENTS.md` — reglas globales del proyecto.
- `docs/architecture.md` — flujo BFF y modularidad.
- `docs/api-endpoints.md` — inventario/contratos API del proyecto.
- `docs/database-schema.md` — esquema en Supabase.
- `docs/conversation-memory.md` — summaries y ventana de contexto.
- `docs/token-cost-policy.md` — principios de coste y contexto.
- `docs/roadmap.md` — fases del MVP y estado de hitos completados.
