# Conversation List MVP Specification

## 1. Objective

El objetivo de esta fase es **permitir ver una lista de conversaciones recientes**, **seleccionar una conversación previa** y **cargar su historial en `/chat`**, sin cambiar la política de contexto del modelo.

Esta fase debe **mejorar la usabilidad** del chat persistido: el usuario deja de depender de conocer manualmente el UUID de una conversación para retomarla. A la vez, **no** se activa todavía autenticación, tenants, memoria avanzada ni el envío del historial completo a Claude. El listado es un complemento de datos y navegación en la UI; el motor de chat sigue operando con el mismo criterio de contexto que en fases anteriores.

## 2. Current System

Resumen del estado actual (tras Chat MVP, Supabase Persistence MVP y Conversation History MVP):

- Las tablas **`conversations`** y **`messages`** existen en **Supabase** y almacenan conversaciones y turnos (user / assistant).
- **`/chat`** crea conversaciones nuevas (o reutiliza un `conversation_id` existente) mediante **`POST /api/chat/turn`**.
- **`/chat`** guarda **`conversation_id`** en **`localStorage`** para sobrevivir a recargas y reabrir la misma conversación.
- **`/chat`** puede cargar el historial de la conversación activa con **`GET /api/chat/history`** usando ese `conversation_id`.
- **No existe** en la UI un listado de conversaciones recientes.
- Para abrir una conversación previa distinta de la guardada en `localStorage`, el usuario **tendría que conocer manualmente su UUID** (o manipular almacenamiento local), lo cual no es viable en uso normal.

## 3. Scope of This Phase

Queda **dentro del alcance**:

- Un **endpoint server-side** para listar conversaciones recientes (ordenadas por actividad reciente, con límite acotado).
- La respuesta debe incluir, como mínimo: **`id`**, **`title`**, **`created_at`**, **`updated_at`**.
- **Opcionalmente** incluir un **`last_message_preview`** (texto breve del último mensaje de la conversación) para orientar en la lista.
- **Limitar** la cantidad de conversaciones devueltas (valor por defecto y techo máximo definidos en la API).
- En **`/chat`**, mostrar una **lista simple** de conversaciones recientes.
- **Permitir seleccionar** una conversación de la lista.
- Al seleccionar: **persistir `conversation_id`** (estado + **`localStorage`**), **llamar a `GET /api/chat/history`** y **mostrar los mensajes** en pantalla.
- **Permitir iniciar una nueva conversación** desde la UI (comportamiento alineado con el flujo actual de “nueva conversación”, limpiando conversación activa y mensajes visibles).

## 4. Out of Scope

Queda **fuera del alcance** explícito de esta fase:

- **Auth** (usuarios, sesiones de login).
- **Tenants** u organizaciones.
- **RLS avanzada** más allá de lo que ya tenga el proyecto para el MVP actual.
- **Ownership por usuario** (cada usuario ve solo sus conversaciones); en este MVP el listado no está modelado por usuario.
- **Summaries** de conversación.
- **Memoria avanzada** (contexto largo gestionado por el backend hacia el modelo).
- **Embeddings**.
- **RAG**.
- **Búsqueda** en conversaciones o en mensajes.
- **Paginación avanzada** (cursores, infinite scroll complejo, filtros múltiples).
- **Edición de títulos** de conversación.
- **Borrado** de conversaciones.
- **Archivado** de conversaciones.
- **WhatsApp**, **n8n**, **voz**.
- **Streaming** de respuestas del asistente.
- **Tools / function calling**.
- **Enviar el historial completo a Claude** en cada turno (la política de contexto del proveedor no cambia en esta fase).

## 5. API Proposal

### Estado de implementación (backend)

**`GET /api/chat/conversations`** ya está implementado en el servidor: usa **`getRecentConversations()`** en `web/lib/chat/persistence.ts`, devuelve conversaciones ordenadas por **`updated_at` descendente**, con **`limit` por defecto 20** y **máximo 50**. El campo **`last_message_preview`** va por ahora siempre en **`null`**. La UI de **`/chat`** (lista y selección) sigue pendiente en esta spec.

### Estado de implementación (UI)

**`/chat`** ahora carga conversaciones recientes desde **`GET /api/chat/conversations?limit=20`**, muestra una lista simple y permite seleccionar una conversación para cargar su historial con **`GET /api/chat/history`**. Esta navegación no cambia la política de contexto: **no** se envía el historial completo a Claude.

### Endpoint

`GET /api/chat/conversations?limit=20`

### Respuesta exitosa (200)

Cuerpo JSON de ejemplo:

```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": null,
      "created_at": "timestamp",
      "updated_at": "timestamp",
      "last_message_preview": "texto opcional"
    }
  ]
}
```

### Reglas

- **`limit` por defecto:** **20** conversaciones si el cliente no envía el parámetro o envía un valor inválido (definir normalización explícita en implementación: p. ej. entero positivo).
- **`limit` máximo:** **50**; valores superiores se deben **recortar** a 50.
- **Orden:** por **`updated_at` descendente** (más recientes primero).
- **No** devolver metadata adicional arbitraria “por si acaso”; mantener el payload **mínimo y estable** para el MVP.
- **No** devolver mensajes completos en este endpoint; solo los campos de conversación y, si aplica, el preview acordado.

### Errores

Ante fallo controlado del servidor (p. ej. error al leer desde Supabase), responder con un cuerpo JSON genérico, sin filtrar errores internos crudos:

```json
{
  "error": "failed to load conversations"
}
```

(Código HTTP exacto —p. ej. 500— se alineará con el patrón ya usado en otras rutas `/api/chat/*` del proyecto.)

## 6. Data Access

- Todo el acceso a datos debe hacerse **solo desde el servidor**, usando **Supabase** con el cliente apropiado del proyecto.
- **No** consultar Supabase directamente desde el frontend.
- Se propone una función futura en:

  **`web/lib/chat/persistence.ts`**

- **Nombre sugerido:** `getRecentConversations({ limit })`.

### Comportamiento esperado de `getRecentConversations`

- Usar **`createSupabaseServerClient()`** (o el helper equivalente ya establecido en el proyecto).
- Consultar la tabla **`conversations`**, ordenadas por **`updated_at` descendente**.
- **Limitar** resultados según `limit` (ya validado/acotado por la capa de ruta antes de llamar a la función, o documentar responsabilidad única en un solo sitio).
- **Opcionalmente** enriquecer cada fila con un **preview del último mensaje** (p. ej. subconsulta, vista, o segunda query agrupada — según convenga al esquema actual).
- Devolver **datos normalizados** al formato acordado en la API (`id`, `title`, `created_at`, `updated_at`, `last_message_preview`).

### Nota de pragmatismo (MVP)

Si obtener **`last_message_preview`** complica la consulta o el rendimiento en esta iteración, se puede **dejar `last_message_preview` como `null`** para todas las filas y completar el preview en una fase posterior. El resto del contrato de la API puede mantenerse igual.

## 7. UI Behavior

En **`/chat`**:

- **Añadir** una lista simple de conversaciones recientes (cargada al montar la página o en un momento explícito de UX simple; evitar lógica de panel complejo).
- Cada ítem debe mostrar, como mínimo:
  - **Identificador corto** (coherente con el ya usado para la conversación activa: p. ej. primeros caracteres del UUID + elipsis, u otra convención ya definida en la UI).
  - **Fecha de actualización** (`updated_at`), en formato legible y localizado de forma sencilla.
  - **Preview** del último mensaje **si existe** (`last_message_preview` no nulo).
- **Al hacer clic** en una conversación:
  - Actualizar **`conversation_id`** en el estado de la página.
  - **Guardar** ese `conversation_id` en **`localStorage`** (misma clave y semántica que el flujo actual de historial).
  - Llamar a **`GET /api/chat/history`** con ese id.
  - **Sustituir o fusionar** los mensajes mostrados según la regla ya usada en historial (idealmente: mostrar el historial recuperado como fuente de verdad de la conversación seleccionada).
- El botón **“Nueva conversación”** debe:
  - **Limpiar** la conversación activa (estado: sin `conversation_id` hasta el próximo turno que cree uno, según el contrato actual de `POST /api/chat/turn`).
  - **Limpiar** los mensajes visibles en pantalla.
  - **Limpiar** la entrada de `conversation_id` en **`localStorage`** para no rehidratar por error una conversación antigua.
- **Mantener diseño simple** (lista vertical, tipografía y espaciado acordes al resto de `/chat`); **no** introducir aún un panel lateral complejo, drawers avanzados ni gestión tipo “bandeja de correo”.

## 8. Token Policy

- Este listado es **solo UI / datos de navegación**: **no** modifica el contexto enviado a **Claude**.
- **Claude** debe **seguir recibiendo solo** el **system prompt** y el **mensaje actual** del usuario (más lo que ya defina el backend hoy por política explícita), **sin** reenvío del **historial completo** desde este MVP.
- Los mensajes cargados vía **`GET /api/chat/history`** continúan siendo **para visualización** y continuidad de producto, no para armar automáticamente un contexto largo hacia el proveedor en esta fase.
- Los **summaries** y estrategias de contexto largo se implementarán en **fases posteriores**, con su propia especificación.

## 9. Privacy and Security

- **No** exponer claves, tokens ni secretos en el cliente, logs públicos ni respuestas de error detalladas.
- **No** consultar Supabase desde el **frontend** directamente para este listado.
- **No** usar **service role** en el cliente; el patrón debe seguir siendo servidor → Supabase con credenciales de entorno.
- **No** devolver al navegador **errores crudos** de Supabase; mensajes genéricos hacia el cliente y detalle solo en logs del servidor si aplica.
- Cuando exista **auth / tenants**, el listado **deberá filtrarse** por usuario u organización; esta especificación asume ese refuerzo futuro sin implementarlo ahora.
- En este **MVP sin auth**, el listado es adecuado solo para **entorno de desarrollo o despliegue controlado** donde quien accede a `/chat` entiende que ve conversaciones globales o no segmentadas por identidad.

## 10. Implementation Plan

Pasos futuros sugeridos (orden lógico; ajustar según el estado del repo al implementar):

1. Añadir **`getRecentConversations({ limit })`** en **`web/lib/chat/persistence.ts`**.
2. Crear la ruta **`GET /api/chat/conversations`** (handler en `web/app/api/chat/conversations/route.ts` o convención equivalente del proyecto).
3. **Validar** y normalizar **`limit`** (defecto 20, máximo 50).
4. Garantizar **orden por `updated_at` descendente** en la consulta.
5. Devolver el array **`conversations`** **normalizado** al contrato JSON acordado.
6. Actualizar **`/chat`** para **cargar** conversaciones recientes al iniciar (o tras acción explícita mínima).
7. **Permitir seleccionar** una conversación y enlazar con el flujo de historial existente.
8. **Reutilizar** **`GET /api/chat/history`** para cargar mensajes al seleccionar.
9. Mantener **`localStorage`** **sincronizado** con la conversación activa en todo momento coherente con “nueva conversación” y “selección”.
10. Probar flujo **“Nueva conversación”** (estado limpio, sin id hasta nuevo turno según diseño actual).
11. Probar **selección** de una conversación previa y verificación visual del historial.
12. **Confirmar** por inspección de red o logs del backend que **Claude no recibe** el historial completo en **`POST /api/chat/turn`** (sin cambiar esa política en esta fase).
13. **Actualizar el roadmap** del proyecto cuando la fase quede completada y estable.

## 11. Verification Criteria

La implementación de esta fase se considerará **correcta** si se cumple todo lo siguiente:

- El **build** del proyecto **pasa** sin errores.
- **`GET /api/chat/conversations`** devuelve **conversaciones recientes** según el contrato (orden, límites, campos).
- **`/chat`** muestra una **lista simple** de conversaciones.
- **Seleccionar** una conversación **carga su historial** en la UI vía **`GET /api/chat/history`**.
- **“Nueva conversación”** **limpia** estado relevante y **`localStorage`** de `conversation_id` según lo definido en esta spec.
- Un **nuevo mensaje** enviado estando en una conversación **seleccionada** **reutiliza** el mismo **`conversation_id`** (continuidad de la conversación activa).
- **Supabase** refleja **`updated_at`** actualizado en la conversación cuando se insertan mensajes (o el mecanismo equivalente ya acordado en el esquema; si no ocurre, corregir persistencia antes de dar por cerrada la fase).
- **Claude** **no** recibe el **historial completo** como contexto de cada turno.
- **No** hay claves ni secretos expuestos en el **frontend**.
- **No** se introduce **auth** ni **tenants** como parte de esta fase.
