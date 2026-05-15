# Conversation Context MVP Specification

## 1. Objective

El objetivo de esta fase es que **Claude reciba un contexto conversacional mínimo y acotado**, construido a partir de los **últimos N mensajes ya persistidos en Supabase**, de modo que respuestas como “¿cómo me llamo?” tras “mi nombre es Ana” sean coherentes **dentro de una ventana reciente**.

En esta fase **no** se envía el historial completo al modelo, **no** se implementan resúmenes (summaries) ni memoria avanzada. El control del coste en tokens se basa en un **límite fijo y bajo** de mensajes recientes (`role` + `content` únicamente), más el **system prompt** breve que ya usa el proyecto.

**Constante recomendada para el MVP:** `CONTEXT_MESSAGE_LIMIT = 6`.

Interpretación operativa: como máximo los **últimos 6 mensajes** de la conversación (filas `user` / `assistant` en orden cronológico). Tras guardar el mensaje `user` del turno actual, esos “últimos 6” **pueden incluir ya** el mensaje actual; en ese caso **no** se debe volver a añadir el mismo contenido como mensaje duplicado al construir el payload para el proveedor.

## 2. Current System

Resumen del comportamiento actual (post bloques Chat, Supabase Persistence, Conversation History y Conversation List):

- La ruta **`/chat`** envía cada turno del usuario mediante **`POST /api/chat/turn`**.
- **`POST /api/chat/turn`** **crea** una conversación nueva o **reutiliza** un `conversation_id` cuando el cliente lo envía.
- Los mensajes **user** y **assistant** se **guardan** en Supabase (tabla de mensajes asociada a la conversación).
- **`/chat`** muestra el historial cargando **`GET /api/chat/history`** por `conversation_id`.
- **`/chat`** lista conversaciones recientes vía **`GET /api/chat/conversations`** y permite **seleccionar** una conversación previa o **iniciar** una nueva.
- El **chat-engine** (`web/lib/chat/chat-engine.ts`) hoy construye la petición al proveedor con **system prompt + únicamente el mensaje actual del usuario**; **no** reinyecta mensajes previos desde Supabase.
- Supabase **sí** contiene mensajes anteriores de la conversación, pero **aún no** se usan como contexto del modelo en cada turno.

## 3. Scope of This Phase

**Dentro del alcance:**

- **Cargar** desde Supabase, antes de llamar a Claude, los **últimos N mensajes** de la conversación identificada por `conversation_id` (con `N` inicialmente igual a `CONTEXT_MESSAGE_LIMIT`, véase arriba).
- **Enviar a Claude** solo ese subconjunto **limitado** de mensajes recientes (alternancia `user` / `assistant` según lo guardado), además del **system prompt** mínimo existente y el flujo del **turno actual**.
- **No** enviar el historial completo de la conversación al modelo.
- **No** implementar summaries, memoria semántica, embeddings ni RAG.
- **Mantener bajo** el consumo de tokens: límite duro de mensajes, sin metadata en el payload al modelo.
- **Conservar** la persistencia actual: seguir guardando **user** y **assistant** por turno como ya funciona hoy.
- **Mantener** el contrato externo de **`POST /api/chat/turn`** (mismos campos de entrada y salida; véase sección 6).

**Valor inicial recomendado:** `CONTEXT_MESSAGE_LIMIT = 6` (últimos 6 mensajes de la conversación en orden cronológico; ver estrategia en sección 5 para evitar duplicar el mensaje actual).

## 4. Out of Scope

Queda **fuera** de esta fase (no diseñar ni implementar aquí):

- Summaries y compresión semántica de historial.
- Memoria avanzada, preferencias globales del usuario entre conversaciones, o “perfil” persistente para el modelo.
- Embeddings, RAG y base de datos vectorial.
- Herramientas / function calling del modelo.
- Streaming de la respuesta.
- Autenticación, multi-tenant, ownership de conversaciones por usuario.
- Canales **WhatsApp**, automatización **n8n**, voz (ElevenLabs, Vapi, etc.).
- Análisis semántico complejo del hilo completo.
- Compresión automática de historial largo hacia el modelo.
- **Enviar todo el historial** a Claude en cada petición.

## 5. Context Strategy

Para cada turno que incluya un `conversation_id` resuelto (nuevo o existente), el flujo **server-side** recomendado es:

1. **Verificar o crear** la conversación (misma lógica que hoy en el route handler).
2. **Guardar** el mensaje **user** del turno en Supabase (persistencia inmediata del input del usuario).
3. **Cargar** los **últimos N** mensajes de esa conversación desde Supabase (`N = CONTEXT_MESSAGE_LIMIT`), **ordenados cronológicamente** (más antiguo → más reciente), listos para el proveedor.
4. **Construir** el contexto para Claude:
   - **System prompt** (corto, sin IDs ni timestamps).
   - **Secuencia** de mensajes recientes con solo `role` y `content` (`user` | `assistant`).
   - **Evitar duplicar** el mensaje actual: si el paso 2 insertó el `user` y el paso 3 lo devuelve dentro de los últimos N, **no** añadir otra vez el mismo turno como mensaje extra al armar el array para el proveedor.
5. **Llamar** a Claude con ese payload acotado.
6. **Guardar** el mensaje **assistant** devuelto.
7. **Responder** al cliente con `{ reply, conversation_id }` como hoy.

**Nota importante:** el orden “guardar user → cargar últimos N” implica que el mensaje del turno actual **puede** estar ya presente en el resultado de la consulta. La capa que construye mensajes para el proveedor debe **normalizar** (por ejemplo: usar exclusivamente la lista cargada tras el insert, o deduplicar por identidad lógica del último mensaje user) para que **no** haya dos mensajes `user` consecutivos idénticos o el mismo contenido repetido.

## 6. API Contract

**`POST /api/chat/turn`** mantiene el **mismo contrato externo** que en el MVP actual.

**Request (JSON):**

```json
{
  "content": "mensaje",
  "conversation_id": "uuid opcional"
}
```

**Response (JSON):**

```json
{
  "reply": "respuesta",
  "conversation_id": "uuid-real"
}
```

En esta fase **no** se añaden campos nuevos obligatorios en la respuesta, **no** se cambian nombres de propiedades y **no** se expone al cliente el detalle del contexto enviado a Claude. Cualquier ampliación futura (por ejemplo telemetría interna) debe valorarse en otra fase y sin romper este contrato.

## 7. Code Structure Proposal

Cambios **futuros** orientativos (no ejecutados en este bloque documental):

### `web/lib/chat/persistence.ts`

- Añadir o reutilizar una función que devuelva mensajes listos para el modelo, por ejemplo:
  - `getMessagesForConversation({ conversation_id, limit })`, **o**
  - una función más explícita: `getRecentMessagesForContext({ conversation_id, limit })`.
- Debe devolver objetos con **`role`** y **`content`**, en **orden cronológico ascendente** (compatible con APIs tipo mensajes de chat).
- La consulta debe respetar el **techo** `limit` (inicialmente `CONTEXT_MESSAGE_LIMIT`).

### `web/lib/chat/chat-engine.ts`

- Actualizar `handleChatTurn` para aceptar un input extendido con contexto opcional, por ejemplo:

```ts
{
  content: string;
  conversation_id?: string | null;
  context_messages?: Array<{ role: "user" | "assistant"; content: string }>;
}
```

- **Alternativa** para mantener el engine más legible: extraer **`buildChatMessagesForProvider(input)`** que reciba `system`, `context_messages` y el mensaje actual (si aplica) y devuelva el array final para el proveedor, centralizando la deduplicación y el orden.

### `web/app/api/chat/turn/route.ts`

- **Orquestar** en un orden claro:
  - crear / reutilizar conversación;
  - persistir **user**;
  - cargar contexto limitado;
  - invocar `handleChatTurn` (o el builder + llamada) con el contexto;
  - persistir **assistant**;
  - devolver JSON al cliente.
- Mantener el **route handler** legible: la límite de líneas razonable sugiere delegar en `persistence` y en helpers del `chat-engine` en lugar de inlined SQL o lógica repetida.

## 8. Token Policy

Reglas **obligatorias** para esta fase:

- **No** enviar el historial completo al modelo.
- **Límite inicial:** últimos **6** mensajes (`CONTEXT_MESSAGE_LIMIT = 6`), salvo decisión explícita futura de ajuste documentado.
- **No** enviar metadata de filas (IDs de mensaje, `conversation_id`, `created_at`, etc.) dentro de los mensajes para Claude.
- **Solo** `role` + `content` en cada mensaje de diálogo enviado al proveedor.
- **System prompt** breve y estable; evitar crecer el system con datos de negocio sensibles.
- Si la conversación tiene **muchos** mensajes, usar **únicamente** la ventana de los más recientes.
- Los **summaries** y estrategias de contexto largo quedan para **fases posteriores** explícitas.

## 9. Edge Cases

| Situación | Comportamiento esperado |
|-----------|-------------------------|
| Conversación **nueva** sin mensajes previos | Tras guardar el `user`, la carga de contexto puede devolver solo ese mensaje (o lista vacía según implementación); el payload al modelo debe ser coherente y **sin duplicados**. |
| Conversación con **menos de N** mensajes | Se envían **todos los disponibles** hasta el máximo real (≤ N). |
| Conversación con **muchos** mensajes | Solo los **últimos N** según política de token/límite. |
| `conversation_id` **inválido** o inexistente | Mantener validación actual: error HTTP controlado, mensaje genérico al cliente, **sin** filtrar detalles internos de Supabase. |
| Fallo al **cargar contexto** | **Error controlado** y **no** llamar a Claude (véase política siguiente). |
| Fallo de Supabase **antes** de Claude (p. ej. al guardar `user` o al leer contexto) | Turno fallido; **no** consumir proveedor si el flujo no puede cumplir la política de contexto acordada. |
| Fallo de **Claude** después de guardar `user` | Turno fallido respecto a `reply`; el `user` puede quedar persistido (comportamiento a alinear con el actual del proyecto). |
| Fallo al **guardar assistant** | Mantener la **política actual**: turno fallido controlado para el cliente; coherencia UI/historial documentada en specs previas. |

**Política recomendada para fallo al cargar contexto:**

- Si no se puede obtener el subconjunto de mensajes recientes de forma fiable, **devolver error** (por ejemplo 503/500 según clasificación interna) con cuerpo **genérico**.
- **No** usar un fallback silencioso “sin contexto” que llame a Claude igualmente, porque reproduciría el bug actual (respuestas incoherentes respecto al hilo mostrado en UI) y mezclaría dos modos de comportamiento sin que el usuario lo sepa.

## 10. Privacy and Security

- **No** exponer claves de API ni secretos en respuestas, logs o payloads al cliente.
- **No** consultar Supabase desde el **frontend**; todo acceso a mensajes para contexto ocurre en **rutas API server-side** o servidor de aplicación.
- **No** enviar a Claude metadata sensible (PII estructurada innecesaria, tokens internos, cabeceras de trazas).
- **No** enviar IDs internos (UUID de mensaje, de conversación) dentro del contenido de mensajes del modelo.
- **No** devolver errores crudos de Supabase al navegador; mensajes de error **opacos** y trazas solo en servidor.
- Cuando existan **auth** y **tenants**, el contexto cargado deberá **filtrarse** estrictamente por usuario/tenant autorizado (preparación para fases futuras; no implementar en este MVP).

## 11. Implementation Plan

Pasos **futuros** sugeridos (orden lógico):

1. Definir la constante **`CONTEXT_MESSAGE_LIMIT = 6`** en un módulo compartido (por ejemplo junto a otras constantes de chat) o en el route, evitando números mágicos dispersos.
2. Implementar **`getRecentMessagesForContext`** (o extender **`getMessagesForConversation`** con `limit` y orden garantizado).
3. Asegurar **orden cronológico** estable en la respuesta de persistencia.
4. Actualizar **tipos** del `chat-engine` para aceptar `context_messages` opcional.
5. Modificar el armado del payload del proveedor para incluir: **system**, **mensajes previos** `user`/`assistant`, y el **turno actual** solo si **no** está ya cubierto por la ventana cargada.
6. Modificar **`/api/chat/turn`** para: guardar `user` → cargar ventana → llamar motor → guardar `assistant`.
7. Añadir pruebas manuales o automatizadas que verifiquen **deduplicación** del último `user`.
8. Mantener intacta la **persistencia** existente y los endpoints de **historial** y **lista** para UI.
9. Probar conversación: turno 1 aporta un hecho estable; turno 2 pregunta por ese hecho dentro de la ventana de N mensajes.
10. Confirmar que Claude **sí** usa el contexto reciente acotado.
11. Confirmar por logs internos (solo servidor) o conteos que **no** se envía el historial completo.
12. Al cerrar la fase de implementación, **actualizar `docs/roadmap.md`** u otra documentación de estado que use el proyecto.

## 12. Verification Criteria

La implementación de esta fase se considerará **correcta** si se cumple todo lo siguiente:

- El **build** del proyecto pasa sin errores.
- Una **conversación nueva** sigue funcionando end-to-end (`reply` + `conversation_id`).
- Una **conversación existente** con historial largo sigue funcionando, pero el modelo solo recibe la **ventana reciente**.
- Los mensajes **user** y **assistant** **siguen guardándose** en Supabase como hasta ahora.
- Claude puede responder correctamente sobre **datos mencionados en turnos recientes** incluidos en la ventana (p. ej. nombre en turnos dentro de los últimos N mensajes).
- Solo se envían los **últimos N** mensajes al proveedor, **nunca** el historial completo de la conversación.
- **`/chat`** puede seguir mostrando historial amplio vía **`GET /api/chat/history`** cuando el producto lo requiera; ese endpoint **no** tiene por qué cambiar su semántica para el modelo.
- **`GET /api/chat/history`** **no** sustituye ni impone el contexto del modelo: el contexto del modelo se decide **solo** en el flujo de **`POST /api/chat/turn`** (u otra ruta server explícita futura, pero no desde el cliente).
- **No** hay summaries implementados en esta fase.
- **No** se filtran ni exponen claves o secretos al cliente.
- **No** hay consultas directas a Supabase desde el frontend para armar el contexto del modelo.

---

**Estado de este documento:** especificación **solo documental** para el bloque de implementación siguiente. **No** modifica código, dependencias, esquema de Supabase ni variables de entorno.

## 13. Implementation Status

**Conversation Context MVP ya está implementado** en el bloque actual:

- Constante exportada `CONTEXT_MESSAGE_LIMIT = 6` en `web/lib/chat/persistence.ts`.
- Función `getRecentMessagesForContext({ conversation_id, limit })` que carga los últimos `N` mensajes (`user` / `assistant`) en orden cronológico ascendente, con tope duro en `CONTEXT_MESSAGE_LIMIT`.
- A Claude se le envía únicamente `role` + `content` por cada mensaje recogido, más el `system prompt` breve existente.
- **No** se envían `id`, `conversation_id`, `created_at` ni `metadata` al modelo.
- **No** se envía historial completo: solo los últimos `≤ 6` mensajes persistidos.
- El mensaje `user` del turno actual se guarda **antes** de cargar contexto, por lo que ya viene incluido en `context_messages` y **no** se duplica al construir el payload.
- Si falla la carga de contexto, `POST /api/chat/turn` devuelve `{ "error": "failed to load conversation context" }` con `500` y **no** se invoca a Claude.
- Los endpoints `GET /api/chat/history` y `GET /api/chat/conversations` no han cambiado.
- **No** se han implementado summaries, memoria avanzada, embeddings, RAG, streaming, tools, auth ni tenants en esta fase.
