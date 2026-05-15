# Spec MVP: Títulos automáticos de conversaciones

**Estado:** especificación de producto **alineada con la implementación** del MVP actual (`web/lib/chat/title.ts`, persistencia en `web/lib/chat/persistence.ts`, integración en `POST /api/chat/turn`). Este documento describe el comportamiento esperado y las extensiones fuera de alcance.

**Referencias:** `docs/current-state.md`, `docs/database-schema.md`, `docs/api-endpoints.md`.

---

## 1. Objetivo

Generar un **título breve y legible** para cada conversación (`public.conversations.title`) usando los **primeros mensajes** del hilo y/o el **contexto inicial** suficiente, de forma que la lista de conversaciones recientes y la UI dejen de depender solo de un **id truncado** o del **preview** cuando el título aún no existe.

**Ejemplo de resultado deseado (producto):**

- En lugar de mostrar principalmente `179b91ac…`
- Mostrar títulos del estilo: `Prueba de summary_update`, `Arquitectura Chat MVP`, `Consulta sobre Supabase`, `Planificación WhatsApp`.

El título debe ser **una sola línea**, **corto**, **sin inventar hechos** no presentes en el texto visible enviado al modelo, y **sin incluir datos sensibles** innecesarios (tokens, emails completos, números de documento, etc.).

---

## 2. Alcance MVP

El MVP debe cumplir **todas** estas condiciones:

| Requisito | Detalle |
|-----------|---------|
| Condición de generación | Generar `title` **solo** si `conversations.title` está **vacío o `null`** (tras normalizar: trim; tratar cadena vacía como “sin título”). |
| Momento | Generar el título **después** de que exista **contexto inicial suficiente** (ver sección 4 y decisión recomendada). |
| Persistencia | **Guardar** el título en `conversations.title` en Supabase (misma fila que `id` de la conversación). |
| Consumo API | El título generado debe **aparecer** en `GET /api/chat/conversations` (ya devuelve `title` junto con `id`, timestamps y `last_message_preview`). |
| UI | La UI existente debe **preferir `title`** cuando exista; si no, **sin romperse** (ver sección 8). |
| Eficiencia | **No** llamar a Claude para título si **ya hay** `title` no vacío; **no** regenerar en cada turno. |

**Extensiones fuera del MVP descrito aquí** (p. ej. edición manual, búsqueda por título, RAG) siguen listadas en la sección 3.

---

## 3. Fuera de alcance (explícitamente no en este MVP)

No implementar todavía:

- Edición manual de títulos por el usuario
- Regeneración manual o “refrescar título”
- Títulos multiidioma avanzados (detección forzada por tenant, glosarios, etc.)
- Búsqueda de conversaciones por título
- Carpetas, colecciones o jerarquías
- Tags o etiquetas
- Analytics de calidad de títulos
- Streaming del título hacia el cliente
- Títulos basados en embeddings, RAG o recuperación semántica amplia

---

## 4. Estrategia recomendada

### 4.1 Disparador (cuándo intentar generar)

1. **Después** de persistir el mensaje del **asistente** en el turno actual (el flujo ya guarda user → Claude → assistant; el título debe evaluarse en un punto **posterior** al guardado del assistant para contar también la primera respuesta del modelo).
2. Leer el estado de la conversación: si **`title` ya está definido y no vacío**, **no hacer nada** (evita llamadas repetidas a Claude).
3. Si `title` falta:
   - Obtener el **número total de mensajes** de la conversación (o un recuento barato acotado si en el futuro se optimiza).
   - Si el recuento es **menor que un umbral** `TITLE_TRIGGER_MESSAGE_COUNT`, **no generar** todavía.
   - Si el recuento es **≥ umbral**, preparar un **subconjunto pequeño** de mensajes iniciales (ver 4.2) y llamar **una vez** a Claude con un **prompt corto** dedicado solo al título.

**Umbral sugerido en spec:** valor configurable por constantes (p. ej. `TITLE_TRIGGER_MESSAGE_COUNT`). La spec contempla **2 o 4 mensajes** como candidatos razonables:

- **2 mensajes:** título más pronto; a veces solo user + assistant inicial (riesgo de título premio o genérico).
- **4 mensajes:** más contexto de intención del usuario y del tono del hilo **antes** del coste de una llamada extra (recomendación por defecto en sección “Decisión recomendada” al final del documento).

### 4.2 Contenido enviado al modelo (ventana pequeña)

- **No** enviar el historial completo.
- Usar solo los **primeros K mensajes** en orden cronológico (`user` / `assistant` según el esquema actual), con `K = TITLE_CONTEXT_MESSAGE_LIMIT` (p. ej. 4 u 6).
- Opcionalmente truncar el contenido de cada mensaje a **N caracteres** por mensaje si algún mensaje es enorme (mitigar tokens y filtrar ruido); límite concreto a fijar en implementación (no crítico para la spec).

### 4.3 Instrucciones al modelo (comportamiento del título)

Pedir explícitamente:

- **Máximo 5–7 palabras** (o equivalente razonable en el idioma detectado).
- **Sin comillas** envolventes.
- **Sin punto final** (ni “…” como cierre obligatorio).
- **Idioma:** el **mismo que la conversación** (inferido del contenido de los mensajes enviados; no forzar inglés si el usuario escribe en español).
- **No inventar** información que no aparezca en el texto proporcionado.
- **No incluir** datos sensibles innecesarios; si el contenido solo contiene datos sensibles, preferir un título **neutro** o **genérico** (“Consulta técnica”, “Soporte”) en lugar de copiar el dato.

### 4.4 Post-procesado (servidor)

Tras recibir la salida de Claude:

- `trim()` de espacios y saltos.
- Eliminar comillas dobles/simples **solo** si rodean todo el string (defensa en profundidad).
- Quitar un punto final único si el modelo lo añade pese a las instrucciones.
- Truncar a una **longitud máxima en caracteres** (p. ej. 80–120) por seguridad de UI/BD.
- Si el resultado queda vacío o es claramente inválido, **no actualizar** `title` (dejar `null`); el chat sigue funcionando.

### 4.5 Persistencia del resultado

- **Una** escritura: `UPDATE` (o upsert coherente con el patrón actual) de `conversations.title` para `conversation_id`.
- Idealmente condicionado a “sigue sin título” para evitar carreras en despliegues futuros (optimistic check: leer `title` de nuevo antes de escribir o usar política de “solo si null”; detalle de concurrencia en implementación).

---

## 5. Reglas de tokens y coste

| Regla | Propuesta |
|-------|-----------|
| Llamadas a Claude | **Como máximo una llamada pequeña por conversación** para generación de título (solo cuando se cumplen disparador + umbral + `title` vacío). |
| Frecuencia | **No** en cada turno; solo en el **primer momento** en que se cumplan las condiciones. |
| Contexto | **No** historial completo; solo **primeros** mensajes hasta `TITLE_CONTEXT_MESSAGE_LIMIT`. |
| `max_tokens` | Bajo: **32 o 64** (suficiente para una línea corta). |
| `temperature` | **Baja** (p. ej. 0.2–0.4) para estabilidad y menos “creatividad” innecesaria. |

**Nota:** la llamada de título es **adicional** a la llamada principal del turno; por eso el umbral de mensajes y el prompt mínimo son importantes para no disparar coste en conversaciones de un solo intercambio irrelevante.

---

## 6. Funciones (organización en código)

### 6.1 `web/lib/chat/persistence.ts`

Funciones orientadas a datos, reutilizables y testeables:

| Función | Responsabilidad |
|---------|-----------------|
| `getConversationTitleState({ conversation_id })` | Devolver al menos `{ title: string \| null }` (o el registro mínimo necesario) para decidir si hace falta generar título. |
| `updateConversationTitle({ conversation_id, title })` | Persistir el título ya saneado; idempotente respecto a “solo si aún vacío” si se acuerda esa política. |
| `getMessagesForTitleGeneration({ conversation_id, limit })` | Devolver los **primeros** `limit` mensajes de la conversación en **orden cronológico** (roles + contenido truncado si aplica). |

**Nota:** nombres y firmas coinciden con el código del MVP.

### 6.2 `web/lib/chat/title.ts`

| Símbolo | Responsabilidad |
|---------|-----------------|
| `TITLE_TRIGGER_MESSAGE_COUNT` | Umbral mínimo de mensajes totales para intentar generar título. |
| `TITLE_CONTEXT_MESSAGE_LIMIT` | Cuántos mensajes iniciales incluir en el prompt. |
| `shouldGenerateConversationTitle` | Decidir si aún falta título y hay mensajes suficientes. |
| `normalizeGeneratedTitle` | Limpiar salida del modelo antes de persistir. |
| `buildConversationTitlePrompt({ messages })` | Construir system/user o un único bloque de instrucciones + texto de mensajes (alineado con el patrón actual de llamadas a Claude). |
| `generateConversationTitleIfNeeded({ conversation_id, ... })` | Orquestación: leer estado → comprobar umbral → llamada Claude → saneo → `updateConversationTitle` → resultado estructurado para la respuesta API. |

**Principio:** la ruta `POST /api/chat/turn` (o `chat-engine`) debe mantenerse **delgada**: invocar `generateConversationTitleIfNeeded` y capturar errores sin romper el flujo principal.

---

## 7. Integración en `POST /api/chat/turn` (implementada)

### 7.1 Orden respecto al flujo actual

En el código actual, tras guardar el assistant:

1. Guardar mensaje **assistant** (ya existente).
2. **Intentar** generación de título **si aplica** (`generateConversationTitleIfNeeded`).
3. Ejecutar **`updateConversationSummaryIfNeeded`**.

**Nota histórica de diseño:** la spec contemplaba alternativas de orden (título antes o después del summary); la implementación eligió **título antes del summary** para aprovechar el assistant recién guardado con pocos mensajes de contexto.

### 7.2 Comportamiento no crítico (resiliencia)

- Si la generación de título **falla** (red, rate limit, error de Claude, error Supabase al escribir), el **chat debe seguir** devolviendo `reply` y `conversation_id` como hoy.
- **No** exponer a cliente stack traces, textos de error internos ni fragmentos del prompt.
- Opcionalmente incluir en la respuesta JSON un **diagnóstico seguro**, análogo a `summary_update`:

```json
"title_update": {
  "attempted": true,
  "updated": false
}
```

- En la implementación actual de `POST /api/chat/turn`, **`title_update.attempted` es siempre `true`** en respuestas exitosas del turno (análogo al bloque de `summary_update`); **`updated: true`** solo si la BD quedó con título nuevo no vacío en ese turno.

**Privacidad:** `title_update` **no** debe incluir el título generado si la política de producto es no ampliar el cuerpo de la respuesta; el cliente puede refrescar la lista con `GET /api/chat/conversations` para ver el título. Si en el futuro se desea optimizar, se podría devolver `title` en la respuesta del turno; **fuera del MVP mínimo** de esta spec salvo decisión explícita posterior.

### 7.3 Proveedor fake / stub

En el MVP implementado se invoca igualmente el proveedor vía `getAIProvider().complete` (en modo **stub** puede persistirse un título derivado del texto fijo del stub si el flujo llega a persistir; el chat no se rompe).

---

## 8. UI (requisitos de producto)

La UI en `/chat` y componentes de lista deben:

- **Mostrar** `title` cuando exista y sea no vacío.
- Si `title` es `null` o vacío, **seguir** mostrando el comportamiento actual: **id corto** y/o **`last_message_preview`** (ya soportado en lista reciente).
- **No bloquearse** ni mostrar errores si `title` falta.
- Tras un turno con `title_update.updated === true`, conviene **refrescar** la lista (`GET /api/chat/conversations`) para mostrar el nuevo `title`.

---

## 9. Criterios de verificación (aceptación / QA manual)

| # | Criterio | Cómo comprobar |
|---|----------|----------------|
| 1 | Conversación nueva sin título | Crear conversación nueva; en BD o vía API, `title` permanece `null` hasta cumplir umbral. |
| 2 | Generación tras contexto suficiente | Enviar mensajes hasta alcanzar `TITLE_TRIGGER_MESSAGE_COUNT`; tras el turno que guarda el assistant y cumple condiciones, aparece título no vacío. |
| 3 | Persistencia Supabase | Inspeccionar `public.conversations` para `id` de prueba: columna `title` actualizada una vez. |
| 4 | API lista | `GET /api/chat/conversations?limit=20` devuelve el nuevo `title` en el elemento correspondiente. |
| 5 | UI | La lista muestra el título legible en lugar de depender solo del id truncado. |
| 6 | No regeneración | Enviar más turnos después de tener título: **no** se observan nuevas llamadas de título (logs/metrics) ni cambios arbitrarios de `title` en BD. |
| 7 | Calidad de repo | `npm run lint` y `npx tsc --noEmit` sin errores nuevos atribuibles al cambio. |

**Prueba negativa:** simular fallo de Claude o de escritura: el usuario sigue recibiendo respuesta del asistente; sin filtrado de datos sensibles en el payload de error.

---

## 10. Riesgos y mitigaciones

| Riesgo | Descripción | Mitigación sugerida |
|--------|-------------|---------------------|
| Títulos genéricos | “Conversa con asistente”, “Ayuda general” | Umbral ≥ 4 mensajes; prompt que pida sustantivos concretos del texto; post-proceso mínimo; iteración futura de prompt (fuera MVP). |
| Llamadas innecesarias a Claude | Disparos por bugs de condición | Comprobar `title` vacío **y** contador de mensajes **antes** de llamar; tests unitarios de la condición. |
| Filtrado de datos sensibles | El modelo copia email, teléfono, API keys del user | Instrucciones explícitas; truncado de mensajes; preferir título neutro; opcionalmente lista de patrones a evitar en post-proceso (MVP mínimo: instrucciones + truncado). |
| Codificación / terminal Windows | Caracteres raros o mojibake en logs locales | No loguear título en bruto en niveles info en producción; UTF-8 consistente en respuestas HTTP; evitar depurar solo con consola CP heredada. |
| Título demasiado pronto | Con 1–2 mensajes el tema aún no está claro | Usar `TITLE_TRIGGER_MESSAGE_COUNT = 4` por defecto (ver decisión final). |
| Latencia adicional | Una llamada extra en un turno “umbral” | Llamada pequeña (`max_tokens` 32–64); ventana mínima; solo una vez por conversación; evaluar orden respecto al summary. |
| Condiciones de carrera | Dos requests paralelos podrían intentar título | Doble chequeo “title sigue null” antes de update; o ignorar segundo error silenciosamente. |

---

## 11. Resumen de decisiones (MVP entregado)

- **Campo:** `public.conversations.title`.
- **Una** generación automática por conversación en el MVP (mientras `title` siga vacío y se cumpla el umbral).
- **Integración:** tras persistir **assistant**, en `POST /api/chat/turn`, con fallos **absorbidos**.
- **Diagnóstico seguro:** `title_update: { attempted, updated }` (sin texto del título en la respuesta del turno).

---

## Implementation Status

- **Implemented in MVP** — Conversation Title MVP cerrado en el código del repo `web/`.
- **Persistence** — `getConversationTitleState`, `updateConversationTitle`, `getMessagesForTitleGeneration` en `web/lib/chat/persistence.ts`.
- **Title module** — `web/lib/chat/title.ts` con `TITLE_TRIGGER_MESSAGE_COUNT = 4`, `TITLE_CONTEXT_MESSAGE_LIMIT = 4`, `shouldGenerateConversationTitle`, `buildConversationTitlePrompt`, `normalizeGeneratedTitle`, `generateConversationTitleIfNeeded`.
- **Turn integration** — `web/app/api/chat/turn/route.ts` invoca `generateConversationTitleIfNeeded` después de guardar el mensaje **assistant** y antes de `updateConversationSummaryIfNeeded`; la generación de título es **no crítica** (el chat sigue si falla).
- **API** — `title_update` añadido a la respuesta JSON de `POST /api/chat/turn` junto a `reply`, `conversation_id` y `summary_update`.
- **List endpoint** — `GET /api/chat/conversations` devuelve `title` y `last_message_preview`.
- **Verified manually** — `title_update.updated` ha llegado a `true`, `conversations.title` ha dejado de ser `null` en pruebas reales (ejemplo observado: «Generación automática de títulos para conversaciones»).

---

## Decisión recomendada (cuándo generar `title`)

**Recomendación:** fijar **`TITLE_TRIGGER_MESSAGE_COUNT = 4`** y **`TITLE_CONTEXT_MESSAGE_LIMIT = 4`** (primeros cuatro mensajes en orden cronológico) como valores por defecto del MVP.

**Motivo:** con cuatro mensajes suele haber al menos dos intercambios user/assistant, lo que da **intención y tema** más claros que con solo dos mensajes, y sigue siendo una ventana **pequeña** para tokens. Si en pruebas internas el título llega “tarde” para el producto, se puede valorar bajar a **2** consciente del riesgo de títulos más genéricos.

---

*Documento de especificación; comportamiento principal implementado en MVP. Las extensiones de la sección 3 permanecen fuera de alcance.*
