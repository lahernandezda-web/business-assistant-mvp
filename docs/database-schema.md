# Esquema de base de datos — MVP web chat

Este documento distingue el **esquema en repo** (`supabase/schema.sql`), lo que la **app usa hoy**, lo que **sigue sin estar** en ese SQL, y el alcance ya cubierto por **Conversation Summary MVP** (implementado).

---

## A. Esquema en repo (fuente de verdad SQL)

Fuente de verdad en repo: **`supabase/schema.sql`**. El acceso desde la app es **solo server-side** (p. ej. `web/lib/chat/persistence.ts`); **no** desde el cliente.

### `conversations`

| Campo        | Tipo / notas     | Descripción                                      |
|-------------|------------------|--------------------------------------------------|
| `id`        | `uuid`, PK       | Identificador del hilo                          |
| `title`     | `text`, nullable | Título opcional                                 |
| `created_at`| `timestamptz`    | Alta                                             |
| `updated_at`| `timestamptz`    | Última actividad (también se actualiza por trigger al insertar mensajes) |
| `metadata`  | `jsonb`          | Metadatos libres (MVP; uso acotado en servidor) |

### `messages`

| Campo             | Tipo / notas | Descripción |
|------------------|--------------|---------------|
| `id`             | `uuid`, PK   | Mensaje       |
| `conversation_id`| `uuid`, FK → `conversations.id` ON DELETE CASCADE | Hilo |
| `role`           | `text`       | `user`, `assistant` o `system` (check en SQL) |
| `content`        | `text`       | Cuerpo        |
| `created_at`     | `timestamptz`| Orden temporal |
| `metadata`       | `jsonb`      | Metadatos libres |

### `conversation_summaries` (Conversation Summary MVP — implementado en app)

Tabla **una fila por conversación** para el resumen acumulado. Forma y FKs en **`supabase/schema.sql`**. La app **no** almacena el resumen en `conversations.summary`; el diseño previsto es **solo** esta tabla para el texto de summary en el MVP.

| Campo                        | Tipo / notas | Descripción |
|-----------------------------|--------------|-------------|
| `conversation_id`          | `uuid`, PK, FK → `conversations.id` ON DELETE CASCADE | Una fila por conversación |
| `summary`                  | `text`, NOT NULL, default `''` | Texto del resumen acumulado |
| `last_message_id`          | `uuid`, nullable, FK → `messages.id` ON DELETE SET NULL | Puntero al último mensaje cubierto por el summary |
| `messages_summarized_count`| `integer`, NOT NULL, default `0` | Conteo asociado al summary |
| `created_at`               | `timestamptz`, NOT NULL, default `now()` | Alta de la fila de summary |
| `updated_at`               | `timestamptz`, NOT NULL, default `now()` | Última actualización (trigger `before update`, misma función que en `conversations`) |
| `metadata`                 | `jsonb`, NOT NULL, default `{}` | Metadatos libres |

**Despliegue:** el SQL está en el repo; en Supabase suele aplicarse **manualmente** en el SQL Editor hasta que exista un pipeline de migraciones. `GET /api/supabase/tables-status` puede reflejar `conversation_summaries_accessible: true` cuando la tabla existe en el proyecto.

Índices y triggers de `conversations` / `messages` siguen en `supabase/schema.sql`; `conversation_summaries` incluye trigger de `updated_at` reutilizando la función PL/pgSQL existente.

---

## B. Qué implementa hoy la app

El flujo de chat **persiste y lee** `conversations`, `messages` y, cuando la tabla existe y la lógica aplica, **`conversation_summaries`**:

- **Lectura** del summary antes de llamar al modelo (`getConversationSummary`); **escritura/actualización** tras el turno según umbrales (`upsertConversationSummary` vía módulo de summary).
- **Claude** recibe **system** + (opcional) bloque de summary + hasta **`CONTEXT_MESSAGE_LIMIT`** mensajes recientes; **no** el historial completo.
- **No** hay endpoints REST dedicados solo a summaries en el MVP; el contrato de diagnóstico en turno es el campo `summary_update` en `POST /api/chat/turn`.

---

## C. No implementado todavía en `supabase/schema.sql` (otras líneas futuras)

Lo siguiente **no** forma parte del SQL del repo (y el código actual **no** depende de ello):

- Tablas **`tenants`**, **`tenant_members`**
- Columnas **`tenant_id`**, **`user_id`** en `conversations`
- **Row Level Security (RLS)** y políticas por `auth.uid()`
- Contadores de tokens, `model`, `latency_ms` u otros campos de auditoría por mensaje en tablas
- Columnas **`conversations.summary`** o **`summary_updated_at`**

Si en el futuro el producto añade auth multi-tenant, el esquema y las políticas deberán documentarse aquí cuando existan migraciones reales.

---

## Relaciones (SQL en repo)

```text
conversations 1──* messages
conversations 1──0..1 conversation_summaries
messages      0..*──0..1 conversation_summaries (last_message_id, opcional)
```

---

## Documentación relacionada

- `docs/api-endpoints.md` — rutas que leen/escriben estas tablas.
- `docs/conversation-memory.md` — contexto hacia Claude (summary + ventana reciente).
- `docs/spec-conversation-summary-mvp.md` — propuesta de `conversation_summaries`.
- `docs/token-cost-policy.md` — política de tokens.
