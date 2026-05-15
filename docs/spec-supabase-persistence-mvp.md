# Supabase Persistence MVP Specification

## 1. Objective

El objetivo de esta fase es añadir **persistencia mínima** para conversaciones y mensajes usando **Supabase**, manteniendo la arquitectura modular existente (chat-engine, providers, validación) y **sin** introducir memoria avanzada, resúmenes ni contexto largo todavía.

**Nota (estado actual del repo):** `POST /api/chat/turn` ya está conectado a la capa `web/lib/chat/persistence.ts`: crea o reutiliza una conversación, guarda mensajes `user` y `assistant` en Supabase y devuelve un `conversation_id` real (UUID). El modelo sigue recibiendo solo system prompt + mensaje actual (sin historial completo).

En esta fase se cumple:

- Guardar conversaciones en base de datos.
- Guardar mensajes del usuario por turno.
- Guardar respuestas del asistente por turno.
- Devolver un `conversation_id` real (UUID) en la respuesta de la API.
- Reutilizar una conversación existente enviando `conversation_id` en el request (sin cargar aún el historial completo hacia el modelo).

Este documento combina especificación y estado del producto; la parte de wiring del turno con Supabase ya está implementada en `web/app/api/chat/turn/route.ts`.

## 2. Current System

Estado aproximado del sistema tras Chat MVP + Claude Provider:

- **Frontend**: ruta `/chat` en Next.js bajo `web/`.
- **API**: `POST /api/chat/turn` procesa cada turno de chat.
- **Validación de entrada**: `web/lib/chat/validate-input.ts`.
- **Motor de chat**: `web/lib/chat/chat-engine.ts` (orquestación del turno).
- **Proveedor de IA en servidor**: capa separada (stub y Claude real vía `@anthropic-ai/sdk`).
- **Persistencia**: cada turno exitoso escribe en `conversations` / `messages` vía el route handler y `persistence.ts`.
- **`conversation_id`**: la API devuelve UUID real; el cliente puede reenviarlo en el siguiente `POST` para continuar la misma conversación.
- **Diagnóstico Supabase (servidor, pre-persistencia)**: `GET /api/supabase/status` devuelve solo booleanos de configuración (`configured`, `has_url`, `has_anon_key`, `has_service_role_key`); no expone claves ni valores; no ejecuta consultas ni valida tablas; no comprueba aún persistencia de `conversations` / `messages`.
- **Comprobación de tablas (servidor, solo lectura)**: `GET /api/supabase/tables-status` usa el cliente server-side (`createSupabaseServerClient`) y consultas mínimas (`select id … limit 1`) contra `conversations` y `messages` para verificar que existen y son accesibles desde el servidor, **sin** insertar, actualizar ni borrar datos. Sirve como health check de esquema/acceso.
- **Capa interna de persistencia (servidor)**: `web/lib/chat/persistence.ts` (`createConversation`, `getConversation`, `saveMessage`) es usada por `POST /api/chat/turn`. Devuelve resultados `{ ok: true, data } | { ok: false, error }` con códigos cortos (`not_configured`, `db_error`, `not_found`) y **no** expone errores crudos de Supabase ni claves.
- **Diagnóstico temporal (retirado):** durante el desarrollo del MVP existió `POST /api/supabase/persistence-test`, un endpoint interno que insertaba una conversación y mensajes `user`/`assistant` de prueba vía `persistence.ts` para validar Supabase antes de cablear el chat. **Ya no forma parte del producto** (ruta eliminada del repo tras verificar la persistencia). La escritura real de conversaciones y mensajes ocurre **solo** en `POST /api/chat/turn`.

## 3. Scope of This Phase

Dentro del alcance de la implementación futura:

- Preparar variables de entorno públicas y de servidor para Supabase (`NEXT_PUBLIC_*` y claves solo servidor donde corresponda).
- Crear un **cliente server-side** de Supabase (no desde el navegador en esta fase).
- Definir y aplicar un **esquema mínimo** de base de datos.
- Crear tabla `conversations`.
- Crear tabla `messages`.
- Persistir **cada turno** de chat (mensaje usuario + respuesta asistente).
- **Generar** una nueva conversación o **recuperar** la existente según `conversation_id` en el request.
- Devolver **`conversation_id` real** desde `POST /api/chat/turn` en la respuesta JSON.

## 4. Out of Scope

Queda explícitamente fuera de esta fase:

- Autenticación real de usuarios.
- Multi-tenant real en base de datos.
- Row Level Security (RLS) avanzada o políticas de aislamiento por usuario/tenant.
- Memoria avanzada (ventanas largas, políticas complejas de contexto).
- Summaries automáticos de conversación.
- Embeddings y búsqueda semántica.
- RAG (retrieval-augmented generation).
- Subida y almacenamiento de archivos adjuntos.
- Integración WhatsApp.
- n8n u otras automatizaciones externas al flujo chat web.
- Voz (ElevenLabs, Vapi, Retell, Realtime, etc.).
- Panel de administración.
- Analytics y métricas de producto.
- Billing y límites comerciales.
- Streaming de tokens en la respuesta HTTP.
- Tools / function calling del modelo.

## 5. Environment Variables

Variables esperadas en `web/.env.local` (valores reales solo en máquina local, nunca en el repositorio):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Reglas:

- **No** documentar ni commitear claves reales en `docs/` ni en código.
- **`web/.env.example`**: solo nombres de variables y placeholders vacíos o valores ficticios claramente no secretos; nunca claves reales.
- **`SUPABASE_SERVICE_ROLE_KEY`**: únicamente en entorno de **servidor** (API routes, server actions, etc.). Nunca enviarla al cliente ni incluirla en bundles del frontend.
- **No exponer** la service role en logs, respuestas de error ni payloads JSON al navegador.
- Las variables `NEXT_PUBLIC_*` pueden usarse en el cliente si en el futuro hace falta; en esta fase se **prioriza** uso **server-side** y **no** consultar Supabase desde el frontend.

## 6. Database Tables

**Esquema SQL inicial en el repo:** existe `supabase/schema.sql` con la definición de las tablas `conversations` y `messages` (constraints, índices y triggers mínimos para `updated_at`). Hay que aplicarlo manualmente en el SQL Editor de Supabase cuando toque desplegar la base; el archivo no se ejecuta solo desde Cursor.

Esquema mínimo conceptual (alineado con el SQL anterior; la migración evolutiva seguirá en fases posteriores).

### Tabla `conversations`

| Campo        | Tipo        | Notas                                      |
|-------------|-------------|--------------------------------------------|
| id          | uuid        | PK, `default gen_random_uuid()`            |
| title       | text        | nullable                                   |
| created_at  | timestamptz | `default now()`                            |
| updated_at  | timestamptz | `default now()` (actualizar en cada turno) |
| metadata    | jsonb       | `default '{}'`                             |

### Tabla `messages`

| Campo           | Tipo        | Notas                                                |
|----------------|-------------|------------------------------------------------------|
| id             | uuid        | PK, `default gen_random_uuid()`                      |
| conversation_id| uuid        | FK → `conversations(id)`, `on delete cascade`        |
| role           | text        | `not null`                                           |
| content        | text        | `not null`                                           |
| created_at     | timestamptz | `default now()`                                      |
| metadata       | jsonb       | `default '{}'`                                       |

**Roles permitidos** (convención de aplicación):

- `user`
- `assistant`
- `system`

Para esta fase MVP se persistirán principalmente:

- `user`
- `assistant`

El rol `system` puede reservarse para extensiones futuras; no es obligatorio persistir el system prompt en la primera iteración si la política de producto lo decide así (debe alinearse con la sección de tokens).

## 7. RLS Strategy for MVP

Sin auth ni tenants reales, hay dos enfoques razonables para desarrollo:

**Opción A**

- Las tablas no se consumen directamente desde el cliente.
- El backend usa el cliente con **service role** (o equivalente server-only) para lecturas/escrituras necesarias.
- El frontend **no** instancia Supabase para esta fase.

**Opción B**

- Posponer RLS estricta hasta que exista autenticación y modelo de tenant/usuario.

**Recomendación para esta fase**

- **No** usar Supabase desde el frontend.
- **Solo** servidor; **no** exponer `SUPABASE_SERVICE_ROLE_KEY`.
- Documentar que **RLS**, políticas por usuario y **tenants** se implementarán cuando exista auth y modelo de datos de identidad.

## 8. API Contract Changes

### Request (contrato actual)

```json
{
  "content": "mensaje",
  "conversation_id": "uuid opcional"
}
```

Sin `conversation_id` (o vacío tras trim) se crea conversación nueva. Con UUID válido existente se reutiliza la misma fila en `conversations`.

Comportamiento esperado:

- Si **`conversation_id` no** se envía o viene vacío: **crear** una nueva fila en `conversations` y usar su `id` para el turno.
- Si **`conversation_id`** viene y es válido: **asociar** los mensajes a esa conversación (tras validar existencia o política mínima acordada).
- **Guardar** mensaje `user` con el contenido del turno.
- Invocar **chat-engine** / proveedor (Claude o stub).
- **Guardar** mensaje `assistant` con la respuesta.
- Responder con el texto del asistente y el identificador de conversación.

### Response

```json
{
  "reply": "respuesta del asistente",
  "conversation_id": "uuid-real"
}
```

Los detalles de códigos HTTP y errores se alinean con la sección 10.

## 9. Code Structure Proposal

Estructura sugerida para la implementación futura (no aplicar en este bloque documental):

```text
web/lib/supabase/
  server.ts

web/lib/chat/
  persistence.ts
```

**`web/lib/supabase/server.ts`**

- Crear y exportar el cliente Supabase **solo para entorno servidor** (lectura de env, sin filtrar secretos al cliente).

**`web/lib/chat/persistence.ts`**

- `createConversation()` — nueva conversación cuando no hay `conversation_id`.
- `getConversation()` — comprobar/recuperar conversación por id (según necesidad mínima).
- `saveMessage()` — insertar una fila en `messages`.
- `saveChatTurn()` — orquestar, si se desea, creación/recuperación + user + assistant en una operación coherente (transacción opcional según diseño final).

El **route handler** de `POST /api/chat/turn` debe permanecer **delgado**: validación, llamada al motor, persistencia vía funciones dedicadas, respuesta JSON.

## 10. Error Handling

Comportamiento deseado (a concretar en implementación sin filtrar secretos):

- Si **falla la creación** de conversación en Supabase: respuesta de error **controlada** (p. ej. 503 o 500 según convención del proyecto), mensaje genérico al cliente, log interno sin datos sensibles.
- Si **falla el guardado** del mensaje **usuario** antes de llamar al modelo: error controlado; **no** llamar al proveedor de IA si la persistencia mínima es requisito estricto del turno (fallar el turno completo).
- Si el modelo **ya generó** la respuesta pero **falla** el guardado del mensaje **assistant** en Supabase: el endpoint debe devolver un **error controlado** al cliente. El turno se considera **fallido**; **no** se debe responder como éxito con `reply` ni dar por bueno el turno en la API.

**Motivo (MVP):**

- En esta fase la persistencia debe ser **consistente**.
- No se aceptan conversaciones **parcialmente** guardadas como resultado “exitoso”.
- Una conversación con mensaje `user` persistido pero **sin** `assistant` correspondiente puede **romper** el historial o la lógica futura de memoria.
- Colas de reintento, warnings internos o mecanismos de recuperación pueden añadirse **después**; **no** forman parte de este MVP.

**Formulación de política (inglés, referencia):**

> If the assistant message cannot be saved after Claude returns a response, the API should return a controlled error instead of pretending the turn completed successfully. For this MVP, consistency is preferred over partial success. Retry queues, internal warnings, or recovery mechanisms can be added in later phases.

Reglas transversales:

- **No** exponer claves ni cabeceras internas de Supabase al cliente.
- **No** devolver el cuerpo crudo de errores internos de Supabase (mensajes SQL, PGRST, etc.).
- **No** loguear contenido de mensajes si contiene datos personales, o aplicar política de redacción acordada con el proyecto.

## 11. Token Policy Alignment

Esta fase **no** debe, por sí sola, enviar a Claude el **historial completo** almacenado en Supabase.

Por ahora:

- Cada turno puede seguir enviando al modelo **solo** el system prompt acordado **más** el mensaje actual del usuario (igual que hoy), salvo que otra política explícita del proyecto lo cambie.
- Guardar mensajes en Supabase **prepara** una fase futura de memoria (relectura de N mensajes, summaries, etc.).
- Los **summaries** y la construcción de **contexto largo** quedan para fases posteriores.
- **No** construir aún un contexto largo a partir de todas las filas de `messages` por defecto.

## 12. Implementation Plan

Pasos sugeridos para el bloque de implementación (orden aproximado):

1. Crear proyecto en Supabase (dashboard).
2. Obtener URL y claves (anon + service role) desde el panel.
3. Actualizar `web/.env.example` con nombres de variables y valores vacíos.
4. Crear o actualizar `web/.env.local` **manualmente** con claves reales (fuera de Git).
5. Aplicar el DDL de `supabase/schema.sql` (sección 6) en el SQL Editor de Supabase, o adaptarlo antes de ejecutar.
6. Añadir dependencia y crear cliente server-side (`web/lib/supabase/server.ts`) cuando corresponda.
7. Implementar funciones de persistencia (`web/lib/chat/persistence.ts`).
8. Actualizar tipos TypeScript del request/response del turno.
9. Actualizar validación para `conversation_id` **opcional** (UUID válido si viene).
10. Actualizar route handler y/o chat-engine para guardar cada turno según el contrato.
11. Probar `POST /api/chat/turn` **sin** `conversation_id` (nueva conversación).
12. Probar **con** `conversation_id` (misma conversación, nuevas filas en `messages`).
13. Actualizar documentación (`docs/roadmap.md`, `docs/api-endpoints.md`, etc. según convención del repo).

**Nota:** El DDL inicial de tablas vive en `supabase/schema.sql` (ejecución manual). Otras frases de este documento sobre no tocar `web/` o dependencias reflejan un bloque puramente de especificación y pueden quedar desactualizadas según el estado del repo.

## 13. Verification Criteria

La implementación futura se considerará correcta si se cumple:

- `npm.cmd run build` (o el comando de build estándar del proyecto) **pasa** sin errores.
- La UI en `/chat` **sigue funcionando** como hoy en flujo básico.
- `POST /api/chat/turn` **sin** `conversation_id` crea una **nueva** conversación y devuelve un UUID nuevo.
- `POST /api/chat/turn` **con** `conversation_id` válido añade mensajes a la **misma** conversación.
- En `messages` existen filas **user** y **assistant** por turno completado con éxito.
- La respuesta incluye **`conversation_id` real** (UUID).
- **No** hay claves de Supabase en el frontend ni en bundles accesibles desde el navegador.
- **No** se expone `SUPABASE_SERVICE_ROLE_KEY` al cliente.
- Con `AI_PROVIDER=stub` el flujo **sigue funcionando** (persistencia + stub).
- Con `AI_PROVIDER=claude` el flujo **sigue funcionando** (persistencia + Claude real).

---

*Documento — Supabase Persistence MVP. Persistencia del turno en `POST /api/chat/turn` implementada; evolución (memoria, RLS, etc.) en fases posteriores.*
