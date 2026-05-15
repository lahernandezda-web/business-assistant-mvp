# Business Assistant MVP — Current Product State

## Purpose

Este documento resume el **estado actual del producto derivado** `business-assistant-mvp`: qué está implementado, qué está verificado y qué queda fuera de alcance. Sirve como checkpoint rápido para futuros bloques de trabajo (Cursor, revisiones, activación controlada de Claude, etc.).

**No describe la base congelada** `CURSOR.p1`. Para la base reutilizable, ver la documentación y specs heredadas en este repo (`docs/current-state.md`, specs de chat/automatización, etc.).

---

## Product Boundary

| Ámbito | Regla |
|--------|--------|
| **Producto** | Vive en `C:\Users\luish\Desktop\business-assistant-mvp`. Aquí se construyen módulos de negocio (Business Profile, contactos futuros, etc.). |
| **Base** | `CURSOR.p1` es la **base completada y congelada**. No modificarla ni construir productos dentro de ella. |
| **Derivación** | El producto se creó desde la base (`chore: initialize business assistant product from base`) y evoluciona con commits propios. |

---

## Current Status

| Área | Estado |
|------|--------|
| **Business Profile MVP** | Completado (SQL, API, UI, integración con chat). |
| **Chat base** | Funcional en modo **stub** (`AI_PROVIDER=stub`). |
| **Supabase** | Configurado (proyecto propio del producto). |
| **Claude** | Desactivado (no activar sin decisión explícita). |
| **n8n / automatizaciones** | Desactivado en producto (`AUTOMATIONS_ENABLED=false`). |
| **Contacts / leads / tasks** | No implementados. |
| **Auth / multi-tenant** | No implementados. |
| **Working tree** | Limpio antes de este bloque de documentación; cambios de doc pendientes de commit por el usuario. |

**Commits relevantes del producto:**

- `chore: initialize business assistant product from base`
- `docs: add business assistant product MVP spec`
- `docs: add business profile MVP spec`
- `db: add business profiles schema`
- `feat: add business profile API`
- `feat: add business profile UI`
- `feat: inject business profile into chat context`

---

## Implemented Modules

### Base inherited from CURSOR.p1

Capacidades reutilizadas en el producto (sin duplicar la base):

- **Chat UI** — `/chat`, envío de turnos, historial y lista de conversaciones.
- **Persistencia** — `conversations`, `messages`, `conversation_summaries` vía Supabase server-side.
- **Summaries** — Resumen acumulado por conversación; ventana reciente al modelo.
- **Conversation list** — Lista reciente con títulos, preview y búsqueda local en UI.
- **Automation base** — Cliente y eventos existen en código; en este producto permanecen **desactivados** (`AUTOMATIONS_ENABLED=false`).
- **Diagnostics** — Endpoints de estado (`/api/health`, `/api/ai/status`, `/api/supabase/status`, etc.) sin exponer secretos.

### Business Profile MVP

#### SQL

- **Archivo:** `supabase/product-business-profile.sql`
- **Tabla:** `public.business_profiles`
- **Campos principales:** `id`, `name`, `industry`, `description`, `target_customer`, `tone`, `services`, `location`, `website`, `metadata`, `created_at`, `updated_at`

#### API

- **Módulo:** `web/lib/business-profile/types.ts`, `validate-input.ts`, `persistence.ts`
- **Ruta:** `web/app/api/business-profile/route.ts`
- **Endpoints:**
  - `GET /api/business-profile` — perfil más reciente o `{ "profile": null }`
  - `POST /api/business-profile` — crea un nuevo perfil (siempre insert, sin upsert)
- **Reglas:** `name` obligatorio; opcionales como `string` o `null`; strings vacíos opcionales → `null`; `metadata` objeto plano; validación → 400; errores internos → mensajes seguros (sin crudo de Supabase ni claves).

#### UI

- **Archivo:** `web/app/business-profile/page.tsx`
- **Ruta:** `/business-profile`
- **Comportamiento:** carga perfil actual; formulario; estados de carga/guardado/error; guardar crea nuevo perfil y recarga el más reciente.

#### Chat Context Integration

- **Formateo:** `web/lib/business-profile/format-context.ts` — `formatBusinessProfileContext()` (bloque compacto; solo campos con valor).
- **Carga:** `web/app/api/chat/turn/route.ts` — `getLatestBusinessProfile()` antes de `handleChatTurn()`.
- **Tipos / motor:** `web/lib/chat/types.ts`, `web/lib/chat/chat-engine.ts` — campo opcional `business_profile_context`; inyección como mensaje de contexto interno (no visible al usuario como bloque repetido).
- **Stub:** `web/lib/ai/fake-provider.ts` — si hay contexto de negocio, la respuesta incluye `[stub: business context received]` sin imprimir el perfil completo.

**Comportamiento de degradación:**

- Sin perfil → el chat funciona igual que antes.
- Error al cargar perfil → `console.warn` y el turno continúa sin contexto de negocio (no bloquea el chat).

---

## Verified Behavior

Comportamiento comprobado en el producto:

| Verificación | Resultado |
|--------------|-----------|
| `/business-profile` | Carga y guarda perfiles. |
| `GET /api/business-profile` | Devuelve perfil o `profile: null`. |
| `POST /api/business-profile` | Crea perfil nuevo. |
| `/chat` | Sigue funcionando (conversación, persistencia, historial). |
| `POST /api/chat/turn` | Recibe contexto del negocio si existe perfil en BD. |
| Modo stub | Respuesta incluye `[stub: business context received]` cuando hay contexto; no imprime el perfil completo. |
| `npm run lint` (desde `web/`) | OK |
| `npx tsc --noEmit` (desde `web/`) | OK |

---

## Security Notes

- **No imprimir** `web/.env.local` ni pegar claves en chats o documentación.
- **Supabase service role** — solo server-side (`createSupabaseServerClient()` en rutas/lib servidor).
- **Claude API key** — solo server-side; no activar Claude sin decisión explícita.
- **n8n webhook secret** — solo server-side; no activar n8n sin decisión explícita.
- **Contexto al modelo** — ventana reciente acotada + summary; **no** enviar historial completo a proveedores de IA.
- **Business Profile en chat** — bloque compacto; sin loguear payloads completos ni secretos.
- **Errores de API** — mensajes seguros al cliente; sin exponer errores crudos de Supabase.

---

## Out of Scope Right Now

No forman parte del estado actual ni del siguiente paso documentado aquí:

- Contacts, leads, `follow_up_tasks`
- WhatsApp, voz
- Billing, dashboard complejo
- Multi-tenant, auth avanzada
- Automatizaciones irreversibles, agentes autónomos
- Dominios sensibles: fiscalidad, legal, médico

---

## Recommended Next Step

**Bloque recomendado:** **Controlled Claude Activation**

Objetivo futuro (solo cuando se decida explícitamente):

1. Activar Claude manualmente en `web/.env.local` (sin imprimir claves).
2. Probar `GET /api/ai/status`.
3. Probar `/chat` con un Business Profile guardado.
4. Verificar coste/tokens y calidad de respuestas.
5. Comprobar que el asistente usa el contexto del negocio **sin inventar** datos no presentes en el perfil.

**No implementar** activación de Claude, cambios de `.env.local` ni push en este bloque de documentación.
