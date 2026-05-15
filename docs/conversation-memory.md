# Memoria de conversación (MVP web)

Cómo se construye el **contexto enviado a Claude** y cómo se separa lo que **ve el modelo** de lo que **solo sirve para la UI y persistencia**. Alineado con `docs/token-cost-policy.md` y el esquema real en `docs/database-schema.md` / `supabase/schema.sql`.

---

## A. Estado actual del MVP (implementado)

- **Summary acumulado:** una fila por conversación en **`conversation_summaries`** (`summary`, punteros y conteos; ver `docs/database-schema.md`). **No** se usa `conversations.summary` como almacén del resumen.
- **Ventana reciente:** hasta **`CONTEXT_MESSAGE_LIMIT = 6`** mensajes `user` / `assistant` (solo `role` + `content`), cargados con `getRecentMessagesForContext()` **después** de guardar el mensaje del usuario (el turno actual queda en esa ventana sin duplicarlo en otro bloque).
- **Claude** recibe, por cada turno vía `POST /api/chat/turn`, en orden:
  1. **System prompt** estable del `chat-engine`.
  2. Si existe summary con texto: un mensaje de contexto tipo **user** con el resumen acumulado (instrucción de no repetirlo al usuario; ver implementación en `web/lib/chat/chat-engine.ts`).
  3. Los **últimos 6** mensajes recientes en orden cronológico.
- **Actualización del summary:** tras persistir la respuesta del **assistant**, el servidor intenta `updateConversationSummaryIfNeeded` (umbrales `SUMMARY_TRIGGER_MESSAGE_COUNT` / `SUMMARY_BATCH_SIZE` en `web/lib/chat/summary.ts`). Si falla, **el chat sigue funcionando**; la API puede devolver `summary_update.updated: false`.
- **No se envía** el historial completo al modelo; la UI puede mostrar mucho más vía `GET /api/chat/history`.
- **No hay** memoria avanzada entre conversaciones, **embeddings** ni **RAG**.

---

## B. Evolución posible (fuera del MVP actual)

- Versionado de summaries, memoria “global” por usuario, hechos estructurados dedicados, o ventanas mayores: **no** forman parte del comportamiento actual; la referencia de diseño del summary MVP sigue en **`docs/spec-conversation-summary-mvp.md`**.

---

## Objetivo (general del producto)

- No reenviar el **transcript completo** en cada turno al modelo.
- **MVP actual:** combinar **resumen acumulado** (`conversation_summaries` cuando aplica) + **ventana reciente** (6 mensajes) + **system estable**.
- Mantener en base de datos el historial necesario para **UX** (recarga, lista de conversaciones) y trazabilidad, sin confundir “lo guardado” con “lo inyectado al modelo”.

---

## Ventana de contexto reciente (hoy)

- Valor fijado en código: **`CONTEXT_MESSAGE_LIMIT = 6`** (`web/lib/chat/persistence.ts`).
- Orden cronológico; solo roles `user` y `assistant` entran en esa ventana para el proveedor.
- Los mensajes más antiguos que la ventana **no** llegan como mensajes completos; el **summary acumulado** aporta contexto compacto de la parte anterior del hilo cuando ya se ha generado.

---

## Resumen persistente (implementado; spec `docs/spec-conversation-summary-mvp.md`)

- El texto compacto vive en **`conversation_summaries`** (no en `conversations.summary`).
- Reglas de cuándo actualizar: umbrales en `web/lib/chat/summary.ts`; política de tokens en `docs/token-cost-policy.md`.

---

## Qué se envía a Claude hoy (orden)

1. **System prompt** — instrucciones del proyecto (incluye pedir respuestas breves por defecto cuando aplica).
2. **Summary acumulado** (opcional) — solo si hay fila con texto en `conversation_summaries`; va como mensaje de contexto, no como historial completo.
3. **Hasta 6 mensajes** `user`/`assistant` recientes — solo `role` y `content` (sin ids, timestamps ni metadata de fila).

No hay un bloque aparte de “fecha / idioma / flags” inyectado más allá de lo que lleve el system prompt y el summary.

---

## Qué no se envía a Claude

- **Claves API** ni tokens de proveedores.
- **Historial completo** persistido si supera la ventana de 6 mensajes.
- **Documentación masiva** (PDFs, FAQs enteras) en cada request.
- **Payload crudo** de webhooks u otros canales no normalizado (cuando existan canales, solo el texto normalizado debe entrar al motor).

---

## Qué se persiste vs qué se inyecta (hoy)

- **Sí persistir** mensajes `user` / `assistant` en `messages` (y metadatos de fila en `metadata` si la app los usa en servidor).
- **Sí persistir** el summary acumulado en **`conversation_summaries`** cuando la lógica de actualización lo escribe.
- La base de datos puede tener **más mensajes** de los que el modelo ve en un turno; eso es deseable para la UI en `/chat` sin inflar el contexto del modelo.

---

## Documentación relacionada

- `docs/token-cost-policy.md` — principios de tokens y valor actual de la ventana.
- `docs/database-schema.md` — tablas reales del MVP y futuro cercano.
- `docs/api-endpoints.md` — dónde se dispara el turno y el historial.
- `docs/spec-conversation-summary-mvp.md` — especificación del summary MVP (implementada en MVP).
- `docs/architecture.md` — visión general (parte del contenido describe fases futuras).
