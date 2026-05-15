# Spec — Automation Integration Base MVP (n8n)

**Tipo:** especificación técnica y de diseño (no implementación).  
**Proyecto:** CURSOR / AI Building System — Next.js App Router en `web/`, Claude server-side, Supabase, chat MVP documentado en `docs/current-state.md`.  
**Relación con otras specs:** `docs/spec-business-assistant-mvp.md` describe capacidades de negocio futuras; **no** forman parte de este MVP de automatización salvo como contexto de evolución.

---

## 1. Objetivo

Definir una **base reutilizable de integración con n8n** para que la aplicación pueda **emitir eventos** hacia flujos externos de forma **segura, acotada y verificable**, sin cambiar el rol del producto como **cerebro conversacional**.

Queda explícito:

- **La app mantiene el motor conversacional:** decide cuándo hablar con el modelo, qué contexto enviar, persistencia de conversaciones, resúmenes, títulos y diagnósticos ya existentes.
- **n8n ejecuta automatizaciones externas:** CRM, hojas de cálculo, correo, notificaciones, tareas, webhooks a terceros y procesos administrativos, según flujos configurados allí.
- **La integración es mediante webhooks salientes desde el servidor de la app hacia URLs de n8n** (HTTP POST), no sustituyendo la lógica de IA ni moviendo el “cerebro” a n8n.

---

## 2. Alcance MVP

Incluido en el alcance de esta fase de diseño (y en la implementación futura alineada con esta spec):

| Área | Descripción |
|------|----------------|
| **Emisión de eventos** | La app (solo servidor) envía payloads JSON a un **único webhook base** de n8n (URL configurable), o a URLs derivadas si n8n lo requiere; el MVP documenta **un contrato** y **un punto de envío** coherente. |
| **Configuración** | Activación y destino vía **variables de entorno** (ver §8); sin secretos en cliente ni en repositorio. |
| **Payload** | **Pequeño, tipado en documentación**, sin historial completo ni claves; solo campos necesarios para el tipo de evento. |
| **Errores** | Manejo **básico**: timeouts, no propagar fallos a la respuesta del chat; logging **mínimo** sin datos sensibles (ver §10). |
| **No bloqueo del chat** | Si n8n falla, **el flujo principal del chat no debe fallar** por ello; la automatización es **best-effort** en el MVP. |
| **Primer evento de prueba** | Evento **`test.automation`** para validar conectividad, secret y contrato sin acoplar aún al ciclo de mensajes. |
| **Contrato documentado** | Esquema del envelope y convenciones de `data` por evento (ver §6). |

---

## 3. Fuera de alcance

No implementar ni diseñar en detalle en esta fase (quedan explícitamente fuera):

- WhatsApp, voz, calendario.
- Integraciones “reales” con CRM, Google Sheets o email como producto terminado (n8n puede simularlas en flujos de prueba, pero no es alcance de la app).
- Multi-tenant, auth avanzada entre tenants.
- Colas (SQS, Bull, etc.), retries exponenciales, dead-letter queues, idempotencia distribuida.
- Dashboard de automatizaciones o editor visual dentro de la app.
- **Tool calling** de Claude, ejecución de herramientas desde el modelo, RAG, embeddings.
- Duplicar lógica de IA en n8n o enviar **historial completo** al webhook.

---

## 4. Rol de la app vs rol de n8n

### App (Next.js servidor + Supabase + Claude)

- **Decide cuándo emitir eventos** (según reglas de producto y flags de entorno).
- **Controla datos sensibles:** no envía secretos, service role, tokens de usuario completos ni volcados de BD.
- **Mantiene** conversación, summaries, titles, persistencia y rutas API actuales (`/api/chat/turn`, etc.).
- **Llama a Claude** y orquesta el contexto compacto al modelo (sin delegar esa decisión a n8n).

### n8n

- **Recibe eventos** HTTP con payload acotado.
- **Ejecuta procesos externos** (nodos de integración, transformaciones, ramificaciones).
- Puede **enviar emails/notificaciones**, **escribir en hojas/CRM** u orquestar webhooks a terceros.
- **No define la lógica conversacional principal** (no sustituye al asistente ni decide el texto de respuesta al usuario final en la app).

---

## 5. Eventos iniciales propuestos

Convención de nombres: `dominio.acción` en minúsculas y `snake_case` dentro de `data` cuando aplique.

| Evento | Descripción breve | MVP base |
|--------|-------------------|----------|
| `test.automation` | Ping de verificación de pipeline app → n8n | **Sí (recomendado como primero)** |
| `conversation.created` | Nueva conversación persistida (id, timestamps mínimos) | **Candidato segundo** (tras validar test) |
| `message.created` | Nuevo mensaje user/assistant persistido (metadatos ligeros, sin cuerpo largo por defecto) | **Candidato alternativo segundo** |
| `conversation.title_generated` | Título actualizado en BD | Futuro |
| `conversation.summary_updated` | Resumen actualizado | Futuro |
| `lead.detected` | Señal de negocio (p. ej. desde reglas futuras Business Assistant) | Futuro |
| `human_followup_requested` | Escalado a humano | Futuro |

**Recomendación MVP base:** implementar y verificar en este orden:

1. **`test.automation`** — validar URL, secret, timeout y no impacto en chat.
2. Tras éxito estable: **`conversation.created`** *o* **`message.created`** (elegir uno para no multiplicar ruido; el otro en iteración siguiente).  
   - **`conversation.created`** es más bajo en volumen y claro para flujos “nuevo hilo”.  
   - **`message.created`** es más granular; requiere disciplina estricta en **no** incluir contenido sensible masivo (solo metadatos en MVP).

---

## 6. Payload mínimo

### Envelope común (obligatorio en todos los eventos)

```json
{
  "event": "test.automation",
  "occurred_at": "2026-05-14T12:00:00.000Z",
  "source": "cursor-ai-building-system",
  "data": {}
}
```

| Campo | Tipo | Requerido | Notas |
|-------|------|-------------|--------|
| `event` | `string` | Sí | Identificador del evento (tabla §5). |
| `occurred_at` | `string` (ISO 8601 UTC) | Sí | Momento de emisión en servidor de la app. |
| `source` | `string` | Sí | Valor fijo acordado para trazabilidad en n8n (`cursor-ai-building-system`). |
| `data` | `object` | Sí | Carga útil específica del evento; puede ser `{}` en test. |

### Campo opcional de correlación

| Campo | Tipo | Requerido | Notas |
|-------|------|-------------|--------|
| `conversation_id` | `string` (UUID) | No | Incluir **solo** cuando el evento esté ligado a una conversación existente; omitir en `test.automation` salvo pruebas explícitas. |

**No incluir en el payload (MVP):**

- API keys, service role key, JWT, cookies.
- Historial completo de mensajes o textos largos del modelo salvo decisión explícita futura y revisión de privacidad.
- Datos personales innecesarios para el flujo n8n; por defecto **metadatos** (ids, tipos, conteos, timestamps).

### Ejemplos por evento (referencia)

**`test.automation`**

```json
{
  "event": "test.automation",
  "occurred_at": "2026-05-14T12:00:00.000Z",
  "source": "cursor-ai-building-system",
  "data": {
    "note": "connectivity check"
  }
}
```

**`conversation.created` (futuro cercano)**

```json
{
  "event": "conversation.created",
  "occurred_at": "2026-05-14T12:00:01.000Z",
  "source": "cursor-ai-building-system",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "created_at": "2026-05-14T12:00:00.500Z"
  }
}
```

**`message.created` (futuro cercano — datos mínimos)**

```json
{
  "event": "message.created",
  "occurred_at": "2026-05-14T12:00:02.000Z",
  "source": "cursor-ai-building-system",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "role": "user",
    "message_id": "…",
    "content_length": 42
  }
}
```

*(El contenido del mensaje no es requisito del MVP base; si algún flujo lo necesita, será una ampliación explícita con revisión de privacidad.)*

---

## 7. Seguridad (MVP)

Estrategia simple, **solo server-side**:

1. **`N8N_WEBHOOK_URL`** — URL del webhook de n8n (HTTPS en entornos reales). La app solo lee esto en el servidor (Route Handlers, Server Actions, `lib` importado solo desde servidor).
2. **`N8N_WEBHOOK_SECRET`** — valor compartido entre la app y el workflow de n8n; **nunca** en `NEXT_PUBLIC_*`, nunca en el bundle del cliente.
3. **Header en la petición saliente**, por ejemplo:  
   `X-Automation-Secret: <valor de N8N_WEBHOOK_SECRET>`  
   El workflow en n8n **rechaza** peticiones sin header válido (HTTP 401/403 según configuración del flujo).

Reglas adicionales:

- **No loguear** el valor del secret ni el header completo; en logs solo estados del tipo `automation_dispatch_failed`, `timeout`, códigos HTTP agregados.
- **Solo llamadas desde código servidor** de Next.js (misma línea que ya protege claves de Claude/Supabase).

---

## 8. Variables de entorno

Propuestas para implementación futura:

| Variable | Propósito |
|----------|-----------|
| `N8N_WEBHOOK_URL=` | URL del webhook n8n que recibirá los POST. |
| `N8N_WEBHOOK_SECRET=` | Secreto compartido para el header `X-Automation-Secret`. |
| `AUTOMATIONS_ENABLED=false` | Interruptor global; si `false`, no se envían webhooks (no-op o early return). |

**Bloque 2 (documentación / entorno):** placeholders seguros añadidos en **`.env.example`** (raíz) y **`web/.env.example`** — mismos nombres, sin valores reales en el repo. (Los bloques 3–6 añadieron cliente, endpoints y verificación; ver **Implementation Status**.)

En **`.env.example`**: las tres pueden aparecer **vacías o con placeholders** (`false` para el flag); **nunca** valores reales de secretos. `.env` / `.env.local` siguen fuera de Git. **`N8N_WEBHOOK_SECRET`** nunca al cliente; uso previsto **solo server-side** cuando exista el cliente de automatización.

---

## Implementation Status

- **Spec:** creada y mantenida en este documento.
- **Entorno:** placeholders añadidos en `.env.example` y `web/.env.example` (Bloque 2).
- **Cliente server-side:** implementado en `web/lib/automations/types.ts`, `events.ts`, `client.ts` (Bloque 3).
- **Diagnóstico:** `GET /api/automations/status` implementado (Bloque 4).
- **Prueba de envío:** `POST /api/automations/test` implementado (Bloque 5).
- **Verificación real con n8n (`test.automation`):** en entorno local, con `AUTOMATIONS_ENABLED=true` y webhook/secret configurados **solo** en `web/.env.local` (no versionado, sin documentar URL ni secret aquí), se verificó `configured: true` en status y `POST /api/automations/test` con `sent: true` y **HTTP 200** — conectividad **app → n8n** confirmada.
- **`conversation.created` implementado:** integrado en **`POST /api/chat/turn`** (solo conversación nueva, tras persistir user); verificación local con n8n (p. ej. `automation_update.conversation_created.attempted` / `sent`); detalle en `docs/spec-automation-conversation-created-mvp.md` (**Implementation Status**).
- **First Generic Automation MVP verificado (end-to-end):** el mismo webhook puede alimentar un flujo n8n que persiste **`conversation.created`** en **Google Sheets** como **log externo genérico** (sin automatización de negocio concreta en la app); ver `docs/spec-first-generic-automation-mvp.md` (**Implementation Status**). Sigue **sin** existir **`message.created`** en la app hasta nueva spec/implementación.
- **Integración chat:** existe para **`conversation.created`**; **`message.created`** sigue pendiente de spec/implementación.
- **Pendiente:** automatización de **negocio** vertical (CRM, leads, WhatsApp, etc.) y eventos adicionales según roadmap; mejoras de **robustez** (retries, colas) fuera del MVP base.

---

## 9. Estructura en código (`web/lib/automations` + rutas API)

Implementado (alineado con el diseño original):

| Ruta | Responsabilidad |
|------|-----------------|
| `web/lib/automations/types.ts` | Tipos TS del envelope, union de `event`, resultado de envío, payload de status, entrada `EmitConversationCreatedEventInput`. |
| `web/lib/automations/client.ts` | Lectura de env, `fetch` con timeout, `sendAutomationEvent`, `getAutomationServerStatus`. |
| `web/lib/automations/events.ts` | `createAutomationEvent`, **`emitConversationCreatedEvent`**. |
| `GET /api/automations/status` | Diagnóstico seguro (booleanos únicamente). |
| `POST /api/automations/test` | Prueba manual de `test.automation` hacia n8n. |
| `POST /api/chat/turn` | Emite **`conversation.created`** cuando corresponde; respuesta incluye **`automation_update`** (ver spec específica). |

**Extensiones futuras en el turno** (p. ej. `message.created`): definir en spec aparte antes de ampliar el contrato público.

---

## 10. Estrategia de errores

| Principio | Comportamiento MVP |
|-----------|-------------------|
| **Chat independiente** | Fallo de n8n **no** debe hacer fallar la respuesta del usuario en el chat. |
| **Errores controlados** | Capturar rechazos de red, HTTP no-2xx y timeouts; devolver control al flujo principal sin re-lanzar en caliente. |
| **Timeout** | Valor razonable sugerido: **2–5 s** (fijar en implementación; documentar el elegido en código cuando exista). |
| **Retries** | **No** retries automáticos complejos en MVP (como máximo un intento único). |
| **Logging** | Mínimo: tipo de fallo, `event`, opcionalmente `conversation_id` si ya es id público en logs internos; **no** body completo ni secretos. |
| **Respuesta al usuario** | El texto y metadatos de la respuesta de chat **no dependen** del éxito del webhook. |

---

## 11. Primer flujo mínimo verificable

Objetivo: probar el tubo **sin acoplar al chat** en el primer paso.

1. **Servidor:** función interna o endpoint dedicado de prueba que, con `AUTOMATIONS_ENABLED=true` y env vars válidas, construya el payload `test.automation` y ejecute POST al `N8N_WEBHOOK_URL`.
2. **n8n:** Webhook Trigger recibe el POST, valida `X-Automation-Secret`, responde **200** con cuerpo simple opcional.
3. **App:** interpreta 2xx como éxito para fines de diagnóstico; cualquier otro caso se registra como fallo sin afectar otras rutas.
4. **Chat:** la integración de **`conversation.created`** en `POST /api/chat/turn` está implementada y verificada (ver spec específica); nuevos eventos requieren spec y revisión de contrato.

---

## 12. Plan de implementación futuro (bloques pequeños)

| Bloque | Contenido |
|--------|-----------|
| **1 — Spec** | Este documento (`docs/spec-automation-integration-mvp.md`) aprobado/alineado con el equipo. |
| **2 — Variables** | Añadir claves a `.env.example` y documentación de arranque; **no** commitear secretos. |
| **3 — Cliente server-side** | `types.ts`, `client.ts`, `events.ts` con envío único y timeout. |
| **4 — Diagnóstico** | `GET /api/automations/status` (opcional, sin secretos). |
| **5 — Evento `test.automation`** | Wire mínimo desde un handler de prueba o el status extendido. |
| **6 — Verificación n8n** | Prueba manual en local: `configured: true` en status; `POST /api/automations/test` con `sent: true` y **HTTP 200** desde n8n (ver **Implementation Status**). Opcional: secret inválido, timeout simulado. |
| **7 — Integración `conversation.created`** | **Hecho** — ver `docs/spec-automation-conversation-created-mvp.md`; `message.created` u otros eventos quedan para una iteración siguiente. |
| **8 — Documentación final** | Actualizar `docs/current-state.md` y, si aplica, README con cómo probar el webhook. |

---

## 13. Criterios de éxito

La base se considera **lista** cuando:

- La app puede enviar **`conversation.created`** desde el turno cuando se crea hilo nuevo y recibir **2xx** de n8n en condiciones normales (ver spec específica).
- La app puede enviar **`test.automation`** a n8n y recibir **2xx** en condiciones normales.
- El webhook está **protegido** por validación del secret en n8n y envío del header desde servidor.
- El secret **no** aparece en frontend, logs ni repo.
- Si n8n falla o hace timeout, **la app no se rompe** y el chat sigue respondiendo.
- `npm run lint` y `npx tsc --noEmit` permanecen limpios tras los cambios de código.
- El **contrato de payload** de esta spec está reflejado en tipos/documentación de implementación.

---

## 14. Riesgos

| Riesgo | Mitigación (MVP) |
|--------|------------------|
| Exponer secretos | Solo env vars servidor; no `NEXT_PUBLIC_*`; revisar logs y respuestas de diagnóstico. |
| Enviar demasiado contexto | Envelope fijo; revisión por evento; por defecto **sin** cuerpo de mensajes completos. |
| n8n bloqueando el chat | Envío **asíncrono** / fire-and-forget desde el punto de llamada, await acotado o sin await en la ruta crítica según patrón elegido; timeout corto. |
| Demasiados eventos antes de validar | Activar primero solo `test.automation`, luego **un** evento de negocio. |
| WhatsApp u otros canales prematuros | Fuera de alcance explícito; no mezclar en los mismos workflows hasta base estable. |
| Mezclar automatización con lógica conversacional | Mantener envíos en capa clara (`lib/automations`); no decidir respuestas del usuario en n8n. |
| Sin timeouts | Obligatorio en `fetch` o wrapper; fallar rápido y de forma silenciosa respecto al UX del chat. |

---

## NO HACER (checklist explícita)

*Varios ítems de la lista original quedaron superados tras los bloques 2–6 de implementación; siguen vigentes las restricciones operativas siguientes.*

- No commitear `.env.local` ni secretos; no documentar URL real de webhook ni secret en el repo.
- No alterar `POST /api/chat/turn` ni prompts hasta definir e implementar eventos desde el chat (la prueba `test.automation` ya está verificada de forma aislada).
- No cambiar esquema Supabase ni políticas para este MVP base salvo necesidad explícita futura.
- No instalar dependencias innecesarias.
- No implementar workflows n8n dentro del repositorio de la app (n8n sigue siendo externo).
- No refactorizar rutas o chat existentes “de paso”.

---

*Documento de diseño. Implementación sujeta a esta spec y a revisión de seguridad antes de exponer URLs de producción.*
