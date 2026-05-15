# Conversation Summary MVP Specification

## 1. Objective

El objetivo de esta fase es **crear y mantener un resumen breve por conversación** para:

- **Reducir tokens** enviados al modelo en conversaciones largas.
- **Conservar contexto relevante** que quedaría fuera si solo se usaran los últimos mensajes.

La estrategia de contexto para cada turno es:

- Un **summary acumulado** de la conversación (texto breve, mantenido en servidor/BD).
- Los **últimos N mensajes recientes** (continuidad inmediata del hilo).
- El **mensaje actual** del usuario queda cubierto por la ventana reciente tras persistir el `user` antes de armar el contexto (sin duplicarlo como segundo bloque).

**No** se enviará el historial completo a Claude. La UI puede seguir mostrando el historial completo al usuario; eso es independiente de lo que recibe el modelo.

---

## Implementation Status

- **Implemented in MVP** (código en `web/`, SQL aplicado manualmente en Supabase según `supabase/schema.sql`).
- Funciones de persistencia: `getConversationSummary`, `upsertConversationSummary`, `getMessagesForSummaryBatch`, `countMessagesForConversation`, `getRecentMessagesForContext` en `web/lib/chat/persistence.ts`.
- Módulo `web/lib/chat/summary.ts` con umbrales **`SUMMARY_TRIGGER_MESSAGE_COUNT = 12`** y **`SUMMARY_BATCH_SIZE = 8`**, `shouldUpdateConversationSummary`, `buildSummaryPrompt`, `updateConversationSummaryIfNeeded`.
- **`POST /api/chat/turn`** integra lectura de summary, contexto reciente, llamada al motor, persistencia del assistant, intento de actualización de summary y respuesta con **`summary_update`** (sin cuerpo del summary en JSON).
- **Claude** recibe: system + (opcional) bloque de summary + hasta **6** mensajes recientes; verificado manualmente en conversación con summary existente.
- **Sin** embeddings, **sin** RAG, **sin** memoria avanzada cross-conversation en esta fase.

---

## 2. Current System

El sistema **incluye** el MVP de summaries acoplado al flujo existente:

- **Supabase:** tablas `conversations`, `messages` y **`conversation_summaries`** (una fila por conversación cuando aplica).
- **`POST /api/chat/turn`:** crea o reutiliza `conversation_id`, persiste **user** y **assistant**, carga contexto reciente (**`CONTEXT_MESSAGE_LIMIT = 6`**), carga summary si existe, llama al motor y devuelve `reply`, `conversation_id`, **`summary_update`**.
- **`GET /api/chat/history`** y **`GET /api/chat/conversations`:** sin cambio de rol respecto a UI y lista.
- **`/chat`:** historial y lista como antes; el modelo **no** recibe el transcript completo.
- **Claude:** system + summary opcional + ventana reciente; **sin** embeddings ni RAG.
- **Actualización de summary:** tras guardar el assistant, con reglas por umbral; fallos en actualización **no** rompen la respuesta del turno.

---

## 3. Scope of This Phase

En el **MVP implementado**, esta fase cubre (y cumple) lo siguiente:

- **Definir y crear** la estructura de datos para almacenar summaries (una fila por conversación en el MVP).
- **Guardar** un summary por conversación (creación y actualización).
- **Actualizar** el summary cuando la conversación crece y se cumplen reglas simples (no en cada turno).
- **Incluir el summary** como parte del contexto enviado a Claude, junto con los últimos N mensajes.
- **Combinar** explícitamente: `summary` + últimos N mensajes + mensaje actual, evitando duplicar información innecesaria.
- **Mantener bajo** el consumo de tokens en llamadas normales y en la llamada de resumen.
- **Garantizar** que nunca se envíe el historial completo al modelo por este camino.

---

## 4. Out of Scope

Queda explícitamente fuera de esta fase:

- Embeddings.
- RAG (retrieval-augmented generation).
- Base de datos vectorial.
- Memoria semántica avanzada o memoria “global” entre conversaciones.
- Tools / function calling del modelo.
- Streaming de respuestas.
- Autenticación de usuarios.
- Multi-tenant / ownership de recursos.
- WhatsApp u otros canales externos.
- n8n u otras automatizaciones.
- Voz (ElevenLabs, Vapi, Retell, Realtime, etc.).
- Análisis semántico complejo o pipelines de NLP propios.
- **Múltiples summaries por conversación** (versionado, historial de summaries, etc.): MVP = **un summary acumulado por `conversation_id`**.
- Recuperación por similitud o búsqueda en espacio vectorial.
- Compresión avanzada del historial (algoritmos genéricos fuera del modelo, etc.).

---

## 5. Database Proposal

### Tabla nueva: `conversation_summaries`

| Campo | Tipo | Notas |
|--------|------|--------|
| `conversation_id` | `uuid` **PRIMARY KEY** | `REFERENCES conversations(id) ON DELETE CASCADE` |
| `summary` | `text` **NOT NULL** **DEFAULT** `''` | Texto del resumen acumulado |
| `last_message_id` | `uuid` **NULL** | `REFERENCES messages(id) ON DELETE SET NULL` |
| `messages_summarized_count` | `integer` **NOT NULL** **DEFAULT** `0` | Cuántos mensajes del hilo ya están “cubiertos” por el summary (definición operativa en implementación) |
| `created_at` | `timestamptz` **NOT NULL** **DEFAULT** `now()` | |
| `updated_at` | `timestamptz` **NOT NULL** **DEFAULT** `now()` | Actualizar en cada escritura del summary |
| `metadata` | `jsonb` **NOT NULL** **DEFAULT** `'{}'::jsonb` | Reservado; **no usar en MVP** |

### Semántica de los campos

- **`conversation_id`**: identifica de forma única la conversación; en MVP hay como máximo una fila de summary por conversación.
- **`summary`**: almacena el **resumen acumulado** (no un log de turnos). Debe ser breve y estable para el coste.
- **`last_message_id`**: marca **hasta qué mensaje** del orden cronológico se consideró incorporado en el último ciclo de resumen (útil para saber qué mensajes son “nuevos” respecto al summary).
- **`messages_summarized_count`**: métrica auxiliar para reglas del tipo “cuántos mensajes nuevos desde el último summary” y para depuración; su definición exacta (qué cuenta como mensaje: user+assistant por turno, etc.) se fijará en implementación de forma consistente.
- **`metadata`**: extensibilidad futura; en MVP se deja vacío u omisión lógica en código.

> **Nota**: En este bloque documental **no** se incluye el SQL definitivo ni migraciones; solo la propuesta. La ejecución en Supabase será un paso posterior del plan de implementación.

---

## 6. Context Strategy

Flujo orientativo **por turno** (orquestado principalmente desde `web/app/api/chat/turn/route.ts`):

1. **Crear o reutilizar** la conversación (`conversation_id`).
2. **Guardar** el mensaje del **usuario** en `messages`.
3. **Cargar** el summary existente de `conversation_summaries` si existe.
4. **Cargar** los últimos **N** mensajes recientes desde `messages` (N acotado por política; hoy el proyecto usa `CONTEXT_MESSAGE_LIMIT = 6` como referencia).
5. **Construir** el contexto para Claude:
   - System prompt (como hoy).
   - **Summary** (si existe y es no vacío), inyectado de forma clara y sin duplicar el contenido de los últimos N mensajes cuando sea evitable.
   - **Últimos N mensajes** en formato compatible con el proveedor (roles, orden).
   - El **mensaje actual** del usuario ya puede estar incluido en el último mensaje de la ventana o manejado según el diseño actual del “chat engine”; lo importante es una sola fuente de verdad para “último user input”.
6. **Llamar** a Claude con ese contexto acotado.
7. **Guardar** la respuesta del **assistant** en `messages`.
8. **Evaluar** si corresponde **actualizar el summary** según las reglas de la sección 7; si sí, lanzar una llamada de resumen acotada y persistir el resultado.

### Principios

- **No duplicar información**: el summary debe ser complementario a la ventana reciente, no una copia literal de los mismos turnos.
- **Summary breve**: priorizar densidad informativa sobre exhaustividad.
- **Últimos mensajes siguen siendo necesarios**: capturan matices, correcciones recientes y el hilo conversacional inmediato.
- **El summary no sustituye por completo** el contexto reciente: es una capa para lo “antiguo” relevante, no para el turno a turno reciente.

---

## 7. When to Summarize

Se define una política **simple y determinista** para el MVP, ajustable después por configuración.

### Constantes sugeridas

| Constante | Valor sugerido | Rol |
|-----------|----------------|-----|
| `SUMMARY_TRIGGER_MESSAGE_COUNT` | `12` | Umbral mínimo de mensajes en la conversación para **considerar** activar la lógica de resumen (evita resumir conversaciones muy cortas). |
| `SUMMARY_BATCH_SIZE` | `8` | Tras el último summary, acumular al menos **8 mensajes nuevos** antes de volver a resumir (control de coste: **no** resumir en cada turno). |

### Regla inicial (ejemplo operativo)

- Si el número total de mensajes de la conversación es **≤ `SUMMARY_TRIGGER_MESSAGE_COUNT`**, normalmente **no** se actualiza el summary (no hay necesidad clara o el coste no se justifica).
- Si hay **más** de `SUMMARY_TRIGGER_MESSAGE_COUNT` mensajes **y** desde el último punto de resumen hay al menos `SUMMARY_BATCH_SIZE` mensajes **nuevos** sin incorporar al summary, entonces se puede disparar un ciclo de actualización de summary.

La definición exacta de “mensaje nuevo” respecto al summary debe alinearse con `last_message_id` y/o `messages_summarized_count` en implementación.

### Coste y frecuencia

- **No** resumir en cada turno.
- Resumir solo cuando haya **suficientes** mensajes nuevos (p. ej. cada `SUMMARY_BATCH_SIZE`).
- Estos valores son **tuning** inicial; podrán cambiarse según métricas reales de tokens y calidad de respuesta.

---

## 8. Summary Prompt Strategy

El summary se generará **con Claude**, usando un **prompt corto y específico** (llamada separada o etapa explícita en servidor), con **límite de tokens de salida** acorde a “breve”.

### El summary debe conservar (prioridad alta)

- **Datos importantes** aportados por el usuario (nombres, fechas, cifras clave cuando sean relevantes para continuar).
- **Decisiones** ya tomadas en la conversación.
- **Objetivos** del usuario y resultado esperado.
- **Preferencias** relevantes (tono, formato, stack, restricciones).
- **Estado actual** del trabajo (“dónde vamos”).
- **Pendientes claros** (próximos pasos explícitos).

### El summary no debe conservar

- Saludos y cortesías irrelevantes.
- Repeticiones y digresiones sin valor para el siguiente turno.
- Errores temporales ya corregidos en mensajes posteriores.
- Texto innecesario o conversación vacía.
- **Datos sensibles** que no sean necesarios para continuar el hilo (minimización: si no hace falta en el resumen, no va).

### Formato

- **Breve**, preferiblemente **estructurado** (por ejemplo secciones con viñetas o encabezados mínimos) para facilitar su inyección en el system o bloque de contexto en turnos posteriores.
- **Útil para el siguiente turno**: debe ayudar al modelo a no perder el hilo global sin necesidad de releer decenas de mensajes.

---

## 9. API / Code Structure Proposal

Se propone mantener **`web/app/api/chat/turn/route.ts`** como **orquestador principal**, delegando lógica de summary en módulos dedicados para no inflar el archivo.

### Archivo nuevo sugerido: `web/lib/chat/summary.ts`

Funciones posibles (nombres orientativos):

- `getConversationSummary(conversation_id)` — lectura de `conversation_summaries`.
- `upsertConversationSummary(input)` — crear/actualizar fila por `conversation_id`.
- `shouldUpdateSummary(input)` — encapsula `SUMMARY_TRIGGER_MESSAGE_COUNT`, `SUMMARY_BATCH_SIZE` y estado (`last_message_id`, conteos).
- `buildSummaryPrompt(input)` — construye el prompt corto y el payload mínimo de mensajes a resumir.
- `updateConversationSummary(input)` — orquesta la llamada a Claude para resumen y persistencia (puede invocar internamente a `upsertConversationSummary`).

### Archivo existente: `web/lib/chat/persistence.ts`

Puede ampliarse con helpers de lectura (sin acoplar la UI):

- `countMessagesForConversation(conversation_id)`
- `getMessagesAfterLastSummary(conversation_id, last_message_id)` o equivalente ordenado por `created_at` / clave de ordenación acordada.
- `getMessagesForSummaryBatch(conversation_id, options)` — devuelve solo el tramo necesario para el batch de resumen, con límites estrictos.

### Integración

- `web/app/api/chat/turn/route.ts`: cargar summary, decidir si actualizar, invocar chat engine con summary opcional.
- **Chat engine** (donde se arme el mensaje final hacia Claude): aceptar **summary como contexto opcional** (p. ej. bloque de texto en system o mensaje `user`/`assistant` sintético **solo si** el diseño del proveedor lo hace limpio; la decisión exacta se toma en implementación evitando duplicados).

---

## 10. Token Policy

Reglas obligatorias para esta fase:

1. **No enviar** el historial completo de `messages` a Claude.
2. **Enviar** un summary **breve** si existe y es válido.
3. **Enviar** siempre los últimos **N** mensajes recientes (N acotado; hoy **`CONTEXT_MESSAGE_LIMIT = 6`** salvo decisión explícita posterior documentada).
4. **Limitar tokens** de la llamada dedicada a generar/actualizar el summary (max tokens de salida bajo, entrada solo con el batch necesario).
5. **No resumir** en cada turno; respetar umbrales (sección 7).
6. **No enviar** `metadata`, IDs internos ni timestamps al modelo **salvo** que sean estrictamente necesarios para lógica interna del prompt; por defecto el contenido expuesto al modelo debe ser mínimo.
7. **Controlar costes**: batch pequeño, summary corto, frecuencia de resumen acotada.

---

## 11. Error Handling

Política recomendada para MVP:

| Situación | Comportamiento sugerido |
|-----------|-------------------------|
| Falla **cargar** summary (error de BD, timeout) | **Implementación MVP:** continuar el turno **solo** con los últimos N mensajes (y system); no bloquear el chat por el summary. **No** loguear el contenido completo del summary. |
| Falla **actualizar** summary **después** de obtener respuesta del assistant | **No bloquear** necesariamente la respuesta ya enviada al usuario; registrar el fallo de forma **controlada** (código de error interno, cola de reintento futura, o flag pendiente) para observabilidad posterior. |
| Errores de Supabase | **No** exponer mensajes crudos ni detalles internos al cliente. |
| Secretos | **No** exponer claves ni tokens en respuestas ni logs. |
| Logs | **No** loguear contenido sensible innecesario (contenido completo de mensajes solo si hay política clara y minimización). |

---

## 12. Privacy and Security

- **No exponer** API keys ni credenciales en cliente, logs o respuestas.
- **No consultar Supabase desde el frontend**; todo acceso a summaries y mensajes para el modelo es **server-side**.
- **Minimizar datos** enviados a Claude: solo batch de resumen y ventana reciente necesarios.
- **No almacenar** en el summary información sensible que no sea necesaria para la continuidad del asistente.
- **Futuro**: cuando existan **auth** y **tenants**, filtrar siempre por usuario/tenant antes de leer o escribir summaries.
- **Propiedad lógica**: el summary pertenece a una **conversación concreta** (`conversation_id`) y debe eliminarse en cascada con la conversación según la FK propuesta.

---

## 13. Implementation Plan

**Estado:** los pasos siguientes reflejan el orden seguido para el **MVP ya entregado**; pueden servir para onboarding o refinamientos futuros.

1. SQL de `conversation_summaries` en `supabase/schema.sql` y ejecución **manual** en Supabase (desarrollo primero).
2. Helpers en `web/lib/chat/persistence.ts` (`getConversationSummary`, `upsertConversationSummary`, batch/conteos).
3. Módulo `web/lib/chat/summary.ts` (umbrales, prompt de resumen, `updateConversationSummaryIfNeeded`).
4. `web/app/api/chat/turn/route.ts`: cargar summary, pasar al motor, tras assistant llamar actualización condicional, devolver `summary_update`.
5. **Chat engine:** aceptar `conversation_summary` opcional e inyectarlo como contexto (p. ej. mensaje `user` dedicado) antes de los mensajes recientes.
6. Pruebas con conversación larga, revisión de tokens y documentación (`docs/roadmap.md`, etc.).

---

## 14. Verification Criteria

La implementación de esta fase se considerará correcta cuando:

- El **build** del proyecto pasa sin errores.
- Existe la tabla **`conversation_summaries`** en Supabase con la forma acordada.
- **Cada conversación puede tener** como máximo un summary (modelo 1:1 en MVP) y las filas se crean/actualizan según reglas.
- El **summary se actualiza** cuando se cumplen las reglas de frecuencia y umbrales.
- **Claude recibe** `summary` (si aplica) **más** los últimos **N** mensajes recientes, **no** el historial completo.
- Los mensajes **user** y **assistant** **siguen guardándose** como hoy.
- **`/chat`** **sigue mostrando** el historial completo en la UI (fuente: endpoints de historial existentes).
- **No** se introducen embeddings ni RAG.
- **No** se exponen claves ni errores crudos de infraestructura.
- **No** se consulta Supabase desde el frontend para summaries.
- Los **costes** se mantienen razonables (resumen no en cada turno, summary breve, batches acotados).

---

## Referencias internas (estado actual del repo)

- Límite de contexto reciente: `CONTEXT_MESSAGE_LIMIT` en `web/lib/chat/persistence.ts`.
- Orquestación del turno: `web/app/api/chat/turn/route.ts`.

Este documento describe el **Conversation Summary MVP** ya **implementado** en el repo; detalle de código en `web/lib/chat/persistence.ts`, `web/lib/chat/summary.ts`, `web/lib/chat/chat-engine.ts` y `web/app/api/chat/turn/route.ts`.
