# Spec — Evento `conversation.created` (Automation Integration MVP)

**Tipo:** especificación técnica y de diseño (no implementación).  
**Proyecto:** CURSOR / AI Building System — Next.js en `web/`, `POST /api/chat/turn`, capa `web/lib/automations/*`, n8n vía webhook saliente.  
**Relación:** amplía `docs/spec-automation-integration-mvp.md` (base, `test.automation`, cliente y endpoints de prueba ya verificados). **No** sustituye esa spec; define solo el **primer evento real** hacia n8n desde el flujo de chat.

---

## 1. Objetivo

Definir el evento **`conversation.created`** como **primer evento real** de automatización: emitirse cuando el backend **crea** una conversación nueva en el contexto de un turno de chat, para que n8n pueda reaccionar (CRM, notificaciones, hojas, etc.) **sin** que la automatización sea crítica para el éxito del turno ni exponga datos sensibles.

Queda explícito:

- Es un evento **real** (no es `test.automation`).
- La emisión es **best-effort** y **no bloqueante** respecto a la respuesta del usuario.
- El payload es **mínimo** y alineado con el envelope común de la spec base.

---

## 2. Cuándo se dispara

### Debe dispararse

**Solo** cuando `POST /api/chat/turn`:

1. **No** recibe `conversation_id` válido reutilizable (flujo “nueva conversación”), **y**
2. El servidor **crea** una nueva fila en `conversations` (nuevo UUID), **y**
3. Se cumple el criterio de persistencia del §4 (recomendación: tras guardar con éxito el **primer mensaje user** en esa conversación).

Así se evita emitir eventos de “conversaciones vacías” que nunca recibieron el primer mensaje.

### No debe dispararse

- Cuando el cliente envía un **`conversation_id`** de una conversación **existente** y el servidor solo reutiliza ese hilo.
- Cuando solo se añade un mensaje nuevo a una conversación ya creada en turnos anteriores (mismo `conversation_id`).
- En **`GET /api/chat/history`**, **`GET /api/chat/conversations`** o cualquier lectura/listado.
- Si la creación de conversación o el guardado del user **falla** (no hay evento sin persistencia coherente).

---

## 3. Payload recomendado

### Envelope

Mismo contrato general que `createAutomationEvent` / `sendAutomationEvent` en la base de automatización:

- `event`: `"conversation.created"`
- `occurred_at`: ISO 8601 UTC
- `source`: `"cursor-ai-building-system"`
- `data`: objeto mínimo descrito abajo (incluye `conversation_id`; **no** hace falta duplicar `conversation_id` fuera de `data` salvo que en implementación se unifique el tipo del cliente explícitamente).

### `data` mínimo recomendado

```json
{
  "event": "conversation.created",
  "occurred_at": "2026-05-14T12:00:01.000Z",
  "source": "cursor-ai-building-system",
  "data": {
    "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-05-14T12:00:00.500Z",
    "title": null,
    "origin": "chat"
  }
}
```

| Campo en `data` | Tipo | Notas |
|-----------------|------|--------|
| `conversation_id` | string (UUID) | Id persistido en `public.conversations`. |
| `created_at` | string (ISO 8601) | Timestamp de creación de la conversación en BD (o equivalente fiable). |
| `title` | `null` \| string | Tras el primer user, suele ser `null` hasta el Conversation Title MVP; incluir explícitamente **`null`** es aceptable para que n8n distinga “sin título aún”. |
| `origin` | literal `"chat"` | Fija el origen del evento para filtros en n8n. |

### No incluir en el payload

- API keys, `service_role`, JWT, cookies, `N8N_WEBHOOK_SECRET`.
- Historial completo, lista de mensajes, contenido del mensaje user (no es necesario para “conversación creada” en MVP).
- Texto de **summary** ni metadatos de resumen.
- Cualquier dato personal o de negocio no estrictamente necesario para “nuevo hilo”.

---

## 4. Integración propuesta en `POST /api/chat/turn`

### Detección

Tras la rama que **crea** conversación (equivalente a `createConversation` + nuevo `conversation_id`), marcar internamente un flag booleano del estilo `is_new_conversation` **solo** en ese camino. Si se reutiliza conversación existente, el flag queda en falso.

### Momento de emisión (recomendado)

**Recomendación:** emitir **`conversation.created` inmediatamente después** de que:

1. La conversación nueva exista en BD, **y**
2. El mensaje **user** del turno actual se haya **guardado correctamente** en `messages`.

Motivos:

- Garantiza correlación **conversación + primer mensaje user** sin eventos de hilos vacíos.
- Mantiene el evento alineado con “el usuario ya inició el hilo con contenido”.

### No bloqueo del flujo

- La llamada a `sendAutomationEvent` **no debe retrasar** la respuesta HTTP del turno por esperar a n8n.
- **Recomendación MVP:** invocar el envío en modo **“fire-and-forget”**: disparar la promesa **sin** `await` en la ruta crítica, con un wrapper interno que capture rechazos y **no** propague error al caller del turno (p. ej. `void emitConversationCreated(...)` que dentro haga `.catch(() => {})` o equivalente mínimo).
- **No** usar colas en esta spec; solo disciplina de no-await + manejo de errores absorbido.

### Alternativa descartada para MVP

- Emitir solo al crear la fila `conversations` **antes** del user: más simple pero genera eventos si el guardado del user falla después; **no recomendado**.

---

## 5. Diagnóstico en la respuesta JSON del turno

### Opciones

| Opción | Pros | Contras |
|--------|------|---------|
| **A — Sin campo nuevo** | Contrato de `POST /api/chat/turn` sin cambios; menos ruido. | Verificación solo vía n8n, logs server-side o futuro endpoint. |
| **B — `automation_update`** | La UI o tests pueden observar `sent` sin mirar n8n. | Más campos públicos, riesgo de acoplamiento y mantenimiento. |

### Recomendación MVP

En la spec original se recomendó la **opción A** (sin campo en la respuesta). **Implementación entregada:** se adoptó la **opción B** — **`automation_update.conversation_created`** con `{ attempted, sent }` para facilitar pruebas y observabilidad sin exponer secretos ni payload.

---

## 6. Manejo de errores

Si n8n falla (red, timeout, HTTP no-2xx, `disabled`, `not_configured`, etc.):

- **No** cambiar el código HTTP del turno a 500 por culpa de la automatización.
- **No** impedir la llamada a Claude ni el guardado del mensaje **assistant**.
- **No** impedir **`title_update`** ni **`summary_update`** (misma política de “no crítico” que ya aplican esas piezas).
- **No** incluir mensajes de error internos de n8n en la respuesta JSON del chat.
- Logging: como mucho un **warning genérico** del tipo “automation dispatch skipped/failed” **sin** URL, secret, stack ni cuerpo del payload completo (opcional y mínimo).

La respuesta del turno incluye `reply`, `conversation_id`, `title_update`, `summary_update` y **`automation_update`** con `conversation_created.attempted` / `sent` (ver implementación); **no** incluye URL, secret ni payload del webhook en la respuesta JSON.

---

## 7. Orden sugerido del turno (con automatización)

Orden lógico recomendado **después** de integrar `conversation.created` (sin alterar la semántica existente de título y summary):

1. Leer y validar el body del turno.
2. **Crear o reutilizar** conversación (`conversation_id`).
3. **Guardar** mensaje **user**.
4. **Si** conversación **nueva** y pasos 2–3 OK → emitir `conversation.created` de forma **no crítica** (§4).
5. Cargar contexto reciente + summary para el modelo.
6. Llamar a **Claude** y obtener respuesta.
7. **Guardar** mensaje **assistant**.
8. Intentar **`generateConversationTitleIfNeeded`** (no crítico).
9. Intentar **`updateConversationSummaryIfNeeded`** (no crítico).
10. **Responder** JSON al cliente.

**Justificación:** el evento sale lo antes posible **después** de tener persistencia mínima fiable (conversación + primer user), y **antes** de Claude. *Implementación actual:* se usa **`await`** sobre la emisión para rellenar `sent` en `automation_update` (posible latencia adicional hasta el timeout del cliente de automatización); el turno **no** falla si n8n responde con error o está desactivado.

---

## 8. Criterios de verificación

La implementación se considerará alineada con esta spec cuando se pueda comprobar que:

1. Un turno **sin** `conversation_id` que cree hilo nuevo provoca **exactamente un** `conversation.created` hacia n8n (con payload mínimo §3).
2. Un turno **con** `conversation_id` existente **no** dispara `conversation.created`.
3. n8n recibe el JSON esperado (incl. header `X-Automation-Secret` según spec base).
4. Si n8n está caído o devuelve error, el cliente **sigue** recibiendo `reply` y el turno completa como hoy.
5. El payload **no** incluye historial completo, summary ni contenido de mensajes.
6. `npm run lint` y `npx tsc --noEmit` siguen limpios en `web/`.

---

## 9. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| **Duplicados** (mismo hilo, dos eventos) | Emitir solo en la rama “nueva conversación” y solo una vez por creación exitosa + user guardado; no reintentar automáticamente en MVP. |
| **Datos innecesarios** en el payload | Ceñirse al §3; revisar antes de ampliar `data`. |
| **Bloquear el chat** por n8n | Emisión **no crítica** (errores absorbidos); `await` en la implementación actual añade latencia acotada por el timeout del cliente de automatización sin cambiar el código HTTP del turno por fallos de n8n. |
| **Mezclar** automatización con lógica conversacional | Mantener emisión en helper dedicado (`emitConversationCreatedEvent`) llamado desde el route; sin ramificar lógica de prompts en n8n. |
| **Ruido** en la respuesta JSON | `automation_update` limitado a dos booleanos por evento; evitar ampliar el contrato sin revisión. |
| **Emitir antes de persistir** | Regla §2 + §4: solo tras conversación + user persistidos. |

---

## 10. Plan de implementación futuro (bloques pequeños)

| Bloque | Estado |
|--------|--------|
| **1 — Spec** | Completado. |
| **2 — Helper** | Completado — `emitConversationCreatedEvent` en `web/lib/automations/`. |
| **3 — Integración en `POST /api/chat/turn`** | Completado. |
| **4 — Prueba con n8n** | Verificado en local (respuestas agregadas; sin documentar URL ni secret). |
| **5 — Documentación final** | Completado (`docs/current-state.md`, `docs/api-endpoints.md`, `docs/roadmap.md`, specs de automatización). |

---

## Implementation Status

- **MVP implementado:** el evento **`conversation.created`** está cableado según esta spec.
- **Helper:** `emitConversationCreatedEvent` en `web/lib/automations/events.ts` (entrada tipada en `types.ts`).
- **Integración:** `POST /api/chat/turn` (`web/app/api/chat/turn/route.ts`) emite solo en conversación **nueva**, tras persistir el **user**; `createConversation` en `persistence.ts` expone `created_at` y `title` para el payload.
- **Respuesta API:** se añadió **`automation_update.conversation_created`** `{ attempted, sent }` (sin URL, secret, payload del evento ni errores internos de n8n).
- **Pruebas reales (local):** turno **sin** `conversation_id` → `attempted: true`, `sent: true` con n8n en **200**; turno **con** `conversation_id` existente → `attempted: false`, `sent: false`; **`title_update`** y **`summary_update`** siguen presentes y coherentes.
- **Seguridad del payload hacia n8n:** no se envían mensajes completos, historial, summary ni secretos (solo metadatos acordados en §3).

---

## NO HACER (restricciones vigentes tras el MVP)

- No integrar **`message.created`** sin spec y revisión de contrato aparte.
- No exponer secretos ni URL en logs o respuestas del turno.
- No enviar historial o summary al webhook de automatización.
- No acoplar Business Assistant ni WhatsApp a este evento sin diseño explícito.

---

*Documento de diseño e historial de implementación. Implementación sujeta a revisión de seguridad.*
