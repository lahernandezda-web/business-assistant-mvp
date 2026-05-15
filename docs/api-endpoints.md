# API — endpoints del MVP web (App Router)

**Next.js** bajo `web/` expone **Route Handlers** en `web/app/api/`. Este documento describe las rutas **activas en el código actual** del MVP de chat con **Claude solo en servidor** y **Supabase vía cliente server-side** (service role en servidor; **no** desde el navegador).

---

## Alcance del MVP actual (auth / multi-tenant)

- **No** hay JWT de usuario ni **RLS** aplicadas en las rutas de chat documentadas aquí como parte del flujo entregado: la persistencia se consume **solo en servidor** con el patrón descrito en `web/lib/chat/persistence.ts`.
- **Tenants**, `tenant_members` y comprobación de membresía por petición son **objetivo futuro** (ver `docs/roadmap.md`, `docs/architecture.md`), **no** el estado actual de estas rutas.

---

## Rutas activas

### `GET /api/health`

- Comprobación mínima de que la app responde (útil para probes locales o despliegue).

### `GET /api/ai/status`

- Diagnóstico **seguro**: proveedor configurado, modelo, si existe API key (**sin** exponer la clave).

### `GET /api/supabase/status`

- Diagnóstico de configuración Supabase (sin secretos en la respuesta).

### `GET /api/supabase/tables-status`

- Comprobación orientativa de tablas esperadas en el proyecto Supabase.

### `POST /api/chat/turn`

**Body JSON:**

- `content` (string, obligatorio): mensaje del usuario.
- `conversation_id` (string UUID, opcional): si se omite, se **crea** una conversación nueva; si se envía, debe existir en `conversations` (si no, error controlado).

**Comportamiento actual:**

1. Validar JSON y cuerpo (`validateChatTurnBody`).
2. Resolver `conversation_id` (crear conversación o verificar que existe).
3. Persistir mensaje **`user`** en `messages`.
4. Si en este turno se **creó** una conversación nueva: intentar emitir el evento de automatización **`conversation.created`** hacia n8n (`emitConversationCreatedEvent`); fallos o desactivación **no** impiden el resto del turno (no se devuelve 500 por n8n). **No** se envían a n8n el contenido del mensaje, el historial ni el summary.
5. Cargar **últimos N** mensajes `user`/`assistant` para contexto del modelo, con **N ≤ `CONTEXT_MESSAGE_LIMIT` (6)** (`getRecentMessagesForContext`).
6. Cargar **summary** actual desde `conversation_summaries` si existe y el texto no está vacío (`getConversationSummary`); si falla la lectura, el turno **continúa sin summary** (sin exponer detalles sensibles).
7. Llamar a Claude vía `handleChatTurn` (**system** + summary opcional como contexto + mensajes recientes).
8. Persistir mensaje **`assistant`**.
9. Intentar **generar título automático** si corresponde (`generateConversationTitleIfNeeded` desde `web/lib/chat/title.ts`); fallos aquí **no** impiden que el usuario ya tenga `reply` ni el paso siguiente.
10. Intentar **actualizar el summary** si corresponde (`updateConversationSummaryIfNeeded`); fallos aquí **no** impiden que el usuario ya tenga `reply`.

**Respuesta JSON:**

```json
{
  "reply": "<string>",
  "conversation_id": "<uuid>",
  "title_update": { "attempted": true, "updated": false },
  "summary_update": { "attempted": true, "updated": true },
  "automation_update": {
    "conversation_created": { "attempted": true, "sent": true }
  }
}
```

- `title_update` indica si se ejecutó el bloque de título en el turno y si el título quedó persistido en `conversations.title` (`updated: true`). **No** incluye el texto del título, el prompt, los mensajes usados ni errores internos (diagnóstico mínimo y seguro).
- `summary_update` indica si se intentó la lógica de resumen y si hubo persistencia nueva del summary en ese turno; **no** incluye el texto del summary ni métricas de longitud (evita filtrar contenido por la API de turno).
- `automation_update.conversation_created`: **`attempted`** es `true` solo si en este turno se creó conversación nueva y se intentó el envío a n8n; en turnos que reutilizan `conversation_id`, **`attempted`** es `false` y **`sent`** es `false`. **`sent`** es `true` solo si el webhook respondió con éxito (`ok` en el cliente de automatización). **No** incluye URL del webhook, secret, payload del evento ni mensajes de error internos de n8n.

**Nota:** El historial completo sigue siendo solo para UI vía `GET /api/chat/history`; no se envía entero a Claude.

### `GET /api/chat/history`

**Query:**

- `conversation_id` (UUID, **obligatorio**).
- `limit` (entero, opcional): la capa de persistencia aplica por defecto **50** y tope **100** (valores fuera de rango se normalizan según `web/lib/chat/persistence.ts`).

**Respuesta:** mensajes de la conversación ordenados por `created_at` (para UI / historial completo hasta el límite pedido).

**Ejemplo:** `GET /api/chat/history?conversation_id=<uuid>`

### `GET /api/chat/conversations`

**Query:**

- `limit` (entero, opcional): por defecto **20**, máximo **50**.

**Respuesta:** lista reciente de conversaciones (orden por `updated_at` descendente). Cada elemento incluye al menos **`id`**, **`title`** (puede ser `null` hasta que el Conversation Title MVP genere el título), **`created_at`**, **`updated_at`** y **`last_message_preview`** (texto derivado del último mensaje `user`/`assistant` de esa conversación).

**Ejemplo:** `GET /api/chat/conversations?limit=20`

---

## Rutas no implementadas (alternativa REST futura)

Las siguientes **no** existen en el repo con estos paths; pueden considerarse **idea / estilo REST alternativo** para un producto con auth y recursos anidados:

- `GET /api/conversations`
- `GET /api/conversations/:id/messages`

El MVP usa en su lugar **`GET /api/chat/conversations`** y **`GET /api/chat/history`** como arriba.

---

## Documentación relacionada

- `docs/database-schema.md` — tablas actuales del MVP.
- `docs/conversation-memory.md` — qué contexto recibe Claude hoy vs futuro.
- `docs/spec-conversation-summary-mvp.md` — especificación del summary MVP (implementada en MVP).
- `docs/spec-conversation-title-mvp.md` — especificación del título automático (implementada en MVP).
- `docs/spec-automation-integration-mvp.md` — automatización saliente hacia n8n (base).
- `docs/spec-automation-conversation-created-mvp.md` — evento `conversation.created` desde el turno (implementado en MVP).
- `docs/architecture.md` — visión y canales futuros.
