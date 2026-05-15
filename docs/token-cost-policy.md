# Política de tokens y costes (Claude API)

Objetivo: usar **Claude API de forma eficiente y barata** sin sacrificar calidad en los casos de uso del MVP. Esta política es normativa para prompts, contexto y persistencia.

## Principios

1. **Menos tokens de entrada** impactan más en coste que micro-optimizar el modelo elegido.
2. **Nunca enviar** historial completo ni documentación masiva en cada turno.
3. **Claude solo en servidor** — no exponer claves; no duplicar llamadas desde cliente y servidor para el mismo turno.

---

## MVP web actual (implementado)

- **Ventana fija al modelo:** hasta los últimos **`CONTEXT_MESSAGE_LIMIT = 6`** mensajes `user`/`assistant` como contexto conversacional (definido en `web/lib/chat/persistence.ts` y usado desde `POST /api/chat/turn`). Solo **`role` y `content`**; no ids ni timestamps de fila.
- **Summary acumulado (cuando existe):** texto breve persistido en **`conversation_summaries`**; se inyecta en el prompt **además** de la ventana de 6 mensajes, **sin** enviar el historial completo. **No** hay embeddings ni RAG.
- **Historial en UI** puede ser mayor (p. ej. vía `GET /api/chat/history`); eso **no** implica que todo se envíe a Claude.
- **Segunda llamada a Claude** solo para **generar/actualizar** el summary cuando la lógica de umbrales lo dispara (`web/lib/chat/summary.ts`); frecuencia acotada para controlar coste.

---

## Reglas de contexto (principios + evolución)

| Regla | Descripción |
|-------|-------------|
| **Ventana fija** | **MVP actual:** últimos hasta **6** mensajes relevantes al modelo (`CONTEXT_MESSAGE_LIMIT`) **más** summary acumulado si existe. **Ideas futuras / otros productos:** ventanas mayores o tope por tokens; cualquier cambio del `6` debe ser decisión explícita y documentada. |
| **Resumen persistente** | **Implementado en MVP:** tabla **`conversation_summaries`** (no `conversations.summary`). En cada turno: **resumen (si hay texto) + ventana reciente**, no todo el transcript. |
| **Hechos estructurados** | Datos repetibles (nombre, idioma, preferencias, campos de negocio) en tablas; inyectar como **lista breve**, no como historial re-narrado. **No** implementado como capa separada en el MVP actual. |
| **System prompt estable** | Instrucciones que no cambian van en **system** fijo; lo que cambia cada turno: bloque opcional de summary + ventana de 6 mensajes. |
| **No re-enviar documentación** | Manuales, FAQs y políticas: versión corta curada o referencia por id; evitar pegar PDFs enteros en cada request. |

---

## Reglas de salida y comportamiento

- Pedir por defecto **respuestas concisas** en system (“máximo X frases salvo que el usuario pida detalle”) para reducir tokens de salida.
- **Tooling**: minimizar rondas de tool calls; combinar lecturas cuando sea posible; no exponer tools que no se usen en el flujo actual.
- **Streaming**: no reduce tokens de facturación por sí solo, pero mejora UX y reduce reintentos por timeout (coste indirecto).

---

## Almacenamiento y metadatos

- **MVP actual:** los mensajes persisten en `messages` con `metadata` jsonb opcional a nivel de fila; **no** hay persistencia automática de `input_tokens` / `output_tokens` / `latency_ms` en tablas como parte del esquema mínimo en `supabase/schema.sql`.
- **Futuro (cuando el producto lo requiera):** guardar por turno `input_tokens`, `output_tokens`, `model`, `stop_reason`, `latency_ms` para auditar coste y depurar fugas de contexto.
- No guardar en claro **secretos** ni payloads innecesarios con PII; referenciar archivos por id en Storage si aplica.

---

## Por canal (futuro)

- **Voz**: prompts y contexto aún más cortos; menos herramientas por turno salvo necesidad.
- **WhatsApp**: mensajes cortos; misma política de ventana + resumen cuando summaries existan.

---

## Revisión

- Revisar esta política cuando cambien **precios de Anthropic**, **límites de contexto** del modelo elegido, el **volumen** de conversaciones o los **umbrales** de resumen (`SUMMARY_TRIGGER_MESSAGE_COUNT`, `SUMMARY_BATCH_SIZE`).

---

## Documentación relacionada

- `docs/architecture.md` — dónde se aplica el contexto en el flujo.
- `docs/roadmap.md` — orden de fases.
- `docs/spec-conversation-summary-mvp.md` — especificación del summary MVP (implementada en MVP).
- `docs/conversation-memory.md` — orden de contexto hacia Claude (summary + recientes).
