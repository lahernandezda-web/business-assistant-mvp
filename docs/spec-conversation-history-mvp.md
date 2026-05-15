# Conversation History MVP Specification

## Estado de implementación (backend)

- **`GET /api/chat/history`** está implementado (`web/app/api/chat/history/route.ts`). Delega en **`getMessagesForConversation()`** (`web/lib/chat/persistence.ts`).
- Devuelve hasta **50** mensajes por defecto y un máximo de **100** (límites inferiores no válidos o por debajo de 50 se normalizan a 50; por encima de 100 se recortan a 100).
- Este historial es **solo para la API/UI**; **no** se envía el historial completo a Claude desde este endpoint.

## Estado de implementación (UI)

- **`/chat`** guarda `conversation_id` en **`localStorage`** bajo la clave `cursor_chat_conversation_id` cuando el backend lo devuelve en **`POST /api/chat/turn`**, y al abrir la página lee esa clave y carga el historial con **`GET /api/chat/history`**.
- El historial recuperado **solo se muestra en la UI**; **no** se reenvía el historial completo a Claude desde el cliente ni desde este flujo de carga.
- La cabecera de **`/chat`** muestra un **identificador corto** (primeros 8 caracteres del `conversation_id` y `...`) cuando hay conversación activa, para orientar al usuario sin listar conversaciones.

## 1. Objective

El objetivo de esta fase es **permitir recuperar y mostrar en la interfaz los mensajes previos** de una conversación ya persistida en Supabase, de forma controlada y acotada al MVP.

En esta fase **no** se activa memoria avanzada, resúmenes semánticos ni estrategias de contexto largo. Tampoco se envía el historial completo al modelo Claude: el historial se usa **solo para la UI**, de modo que el usuario vea la continuidad de la conversación tras recargar o reabrir el chat, sin cambiar aún la política de tokens del motor de chat.

## 2. Current System

El sistema actual se comporta así:

- La ruta **`/chat`** envía mensajes del usuario mediante **`POST /api/chat/turn`**.
- **`POST /api/chat/turn`** crea una nueva conversación o **reutiliza** un `conversation_id` existente cuando la sesión ya lo tiene.
- La tabla **`messages`** almacena turnos **user** y **assistant** asociados a esa conversación.
- **`/chat`** mantiene el **`conversation_id` en estado local** (React u otro estado de cliente) durante la sesión activa en el navegador.
- Si el usuario **recarga la página**, el estado local del cliente se reinicia y, con el diseño actual, **se pierde** el `conversation_id` que no se había restaurado desde ningún otro almacenamiento.
- **No existe** un listado de conversaciones en la UI.
- **No existe** carga de historial previo al montar la página: la UI no rehidrata mensajes antiguos desde el servidor.

La persistencia real ocurre en **`POST /api/chat/turn`**; no hay flujo separado de “solo prueba” de persistencia en producción.

## 3. Scope of This Phase

Queda **dentro del alcance**:

- Un **endpoint server-side** para leer los mensajes de una conversación concreta, identificada por `conversation_id`.
- **Validación** del parámetro `conversation_id` (presencia, tipo string, formato UUID razonable si aplica).
- Respuesta con mensajes **ordenados por `created_at` ascendente** (cronología natural del diálogo).
- **Límite** en la cantidad de mensajes devueltos (por ejemplo un máximo fijo o configurable por query con techo) para proteger rendimiento y payloads.
- Actualizar **`/chat`** para que, cuando exista un `conversation_id` conocido (estado o almacenamiento local), **solicite y muestre** ese historial al iniciar.
- **Opcional (MVP desarrollo):** persistir `conversation_id` en **`localStorage`** para que un refresh recupere la misma conversación sin listado global de chats.

## 4. Out of Scope

Queda **fuera del alcance** de esta fase (no implementar ni diseñar en detalle aquí):

- **Autenticación** de usuarios.
- **Multi-tenant** u organizaciones.
- **RLS avanzada** más allá de lo estrictamente necesario para el MVP actual del proyecto (sin expandir modelo de permisos).
- **Summaries** automáticos de conversación.
- **Memoria semántica** o conversaciones “recordadas” por significado.
- **Embeddings** y búsqueda vectorial.
- **RAG** (recuperación aumentada por documentos).
- **Enviar el historial completo** (o un gran tramo) a **Claude** en cada turno.
- **Listado completo** de conversaciones del usuario.
- **Renombrar** conversaciones.
- **Búsqueda** en historial.
- **Paginación avanzada** (cursores, infinite scroll complejo); solo un límite simple y orden fijo puede bastar para el MVP.
- **WhatsApp**, **n8n**, **voz** y otros canales o integraciones.

## 5. API Proposal

### Endpoint

`GET /api/chat/history?conversation_id=<uuid>`

### Respuesta exitosa (200)

Cuerpo JSON de ejemplo:

```json
{
  "conversation_id": "uuid",
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "texto",
      "created_at": "timestamp"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "texto",
      "created_at": "timestamp"
    }
  ]
}
```

Notas:

- `created_at` debe seguir el formato acordado con el resto de la API (por ejemplo ISO 8601 en string).
- `role` se limita a los valores ya persistidos (`user`, `assistant`).

### Errores (respuestas de error estructuradas o mensajes claros, sin filtrar internals)

Casos previstos:

| Condición | Mensaje / código sugerido |
|-----------|---------------------------|
| Falta `conversation_id` en query | `conversation_id missing` |
| `conversation_id` no es string válido / tipo incorrecto | `conversation_id must be a string` |
| No existe conversación con ese id | `conversation not found` |
| Error al consultar Supabase u otro fallo interno controlado | `failed to load messages` |

La API **no** debe devolver el mensaje crudo de error de Supabase al cliente.

## 6. Data Access

- **Solo** cliente Supabase **server-side** (por ejemplo en route handlers de Next.js o equivalente), con las mismas convenciones que el resto del backend.
- **Prohibido** consultar Supabase directamente desde el frontend con claves sensibles.

### Función futura sugerida

Ubicación propuesta:

`web/lib/chat/persistence.ts`

Nombre y firma orientativa:

```ts
getMessagesForConversation({ conversation_id, limit })
```

Responsabilidades:

1. **Verificar** que la conversación existe (o que hay mensajes asociados según la regla de negocio acordada con el esquema actual).
2. **Cargar** filas de `messages` para ese `conversation_id`.
3. **Ordenar** por `created_at` **ascendente**.
4. **Aplicar** un límite razonable (constante con techo, por ejemplo máximo 100–200 mensajes o el valor que el equipo fije documentado en implementación).

La ruta `GET /api/chat/history` debe delegar en esta función (o en un módulo compartido que la llame) para mantener una sola capa de acceso a datos.

## 7. UI Behavior

En **`/chat`**:

- Seguir manteniendo **`conversation_id` en estado local** cuando el usuario envía mensajes y el servidor devuelve o confirma el id.
- **Opcionalmente** guardar `conversation_id` en **`localStorage`** (clave clara y versionada si hace falta) para desarrollo y prueba del MVP tras refresh.
- **Al montar** la página (o el layout del chat): si existe `conversation_id` en estado restaurado o en `localStorage`, **llamar a** `GET /api/chat/history` y **fusionar** el resultado en la lista de mensajes mostrada.
- **Mostrar** los mensajes previos en el mismo hilo visual que los nuevos.
- Si la carga falla, mostrar un **error simple** (texto o banner mínimo) sin romper la posibilidad de seguir usando el chat si el flujo lo permite.
- Tras cargar historial, el usuario debe poder **seguir enviando mensajes** en la **misma** conversación (mismo `conversation_id` reutilizado por `POST /api/chat/turn`).
- Mantener **diseño simple** acorde al MVP actual (sin nuevas pantallas complejas).

## 8. Token Policy

- Esta fase **solo** carga historial para **mostrarlo en la UI**.
- **No** debe enviarse todavía el historial completo a Claude en cada petición de turno.
- El **Chat Engine** sigue operando con **system prompt + mensaje actual** (o el subconjunto mínimo que ya use hoy el proyecto), sin incluir automáticamente todos los mensajes cargados desde Supabase.
- En una **fase posterior** se decidirá una política explícita de contexto: por ejemplo **últimos N mensajes** más **summary**, límites de caracteres, etc.
- Objetivo explícito: **evitar aumento accidental de tokens** y costes al confundir “historial en UI” con “contexto del modelo”.

## 9. Privacy and Security

- **No** exponer claves de API ni secretos de Supabase en el frontend ni en respuestas JSON de depuración.
- **No** usar **service role** en el navegador; solo patrones server-side ya alineados con el proyecto.
- **No** devolver errores crudos de Supabase al cliente; mapear a mensajes controlados (véase sección 5).
- **No** cargar conversaciones sin **validar** `conversation_id` en el servidor.
- Cuando exista **auth** y **tenants**, será obligatorio **comprobar ownership** (el usuario solo puede leer conversaciones que le pertenecen). Esta especificación lo deja como requisito futuro sin implementarlo en esta fase.

## 10. Implementation Plan

Orden sugerido para el siguiente bloque de implementación:

1. Añadir la función **`getMessagesForConversation`** en `web/lib/chat/persistence.ts` (o el path final acordado con el monorepo).
2. Crear la ruta **`GET /api/chat/history`** que use el cliente Supabase server-side y la función anterior.
3. **Validar** `conversation_id` en la query (presencia, tipo, formato).
4. **Limitar** mensajes devueltos y ordenar por `created_at` asc.
5. Actualizar **`/chat`** para **guardar** `conversation_id` en `localStorage` (opcional pero recomendado para verificar el MVP).
6. **Cargar historial al montar** si existe `conversation_id` persistido o en estado inicial.
7. **Probar** recarga de página: historial visible y mismo hilo.
8. **Confirmar** por inspección de código o logs de servidor que Claude **no** recibe el historial completo cargado para UI.
9. Cuando la fase esté terminada, **actualizar** `docs/roadmap.md` reflejando Conversation History MVP como completado o en curso según corresponda.

## 11. Verification Criteria

La implementación de esta fase se considerará **correcta** si se cumple todo lo siguiente:

- El **build** del proyecto **pasa** sin errores.
- **`GET /api/chat/history`** devuelve mensajes **ordenados** por `created_at` ascendente y respeta el **límite** acordado.
- **`/chat`** **recarga el historial** después de **refrescar** la página cuando hay `conversation_id` disponible (estado + `localStorage` según lo implementado).
- Al enviar un **nuevo mensaje**, el cliente **reutiliza** el mismo **`conversation_id`** que la conversación cargada.
- **Supabase** sigue guardando correctamente pares **user** / **assistant** vía el flujo existente de **`POST /api/chat/turn`**.
- **Claude no recibe** el historial completo todavía; el contexto enviado al modelo permanece acotado según la política de la sección 8.
- **No** hay claves ni service role expuestos en el frontend.
- **No** se introduce auth multi-usuario, tenants, ni RLS avanzada como parte de esta fase.

---

*Documento guía para implementar Conversation History MVP en el bloque siguiente. Solo especificación; sin cambios de código en el alcance de creación de este archivo.*
