# Business Assistant MVP — Current Product State

## Purpose

Este documento resume el **estado actual del producto derivado** `business-assistant-mvp` (**Nivel 2**): qué está implementado, qué está verificado y qué queda fuera de alcance. Sirve como checkpoint rápido para futuros bloques de trabajo (Cursor, revisiones, specs de módulos, etc.).

**No describe la base congelada** `CURSOR.p1` (**Nivel 1**). Para la base reutilizable, ver la documentación y specs heredadas en este repo (`docs/current-state.md`, specs de chat/automatización, etc.).

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
| **Chat base** | Funcional con **Claude** en local; stub sigue disponible si se configura `AI_PROVIDER=stub`. |
| **Supabase** | Configurado (proyecto propio del producto). |
| **Claude** | Activado manualmente en entorno local (`web/.env.local`; clave no documentada). Modelo: `claude-haiku-4-5`. |
| **Límites de capacidades** | Bloque *Current product capabilities* en system prompt (`chat-engine.ts`). |
| **n8n / automatizaciones** | Desactivado en producto (`AUTOMATIONS_ENABLED=false`). |
| **Contacts MVP v1** | Completado (SPEC, SQL, API GET/POST, UI `/contacts`). Sin integración con chat. |
| **Follow-up Tasks MVP v1** | Completado (SPEC, SQL, API GET/POST, UI `/follow-up-tasks`). Sin integración con chat. |
| **Navigation MVP** | Completado (`ModuleNav` en `/chat`, `/business-profile`, `/contacts`, `/follow-up-tasks`). |
| **Auth / multi-tenant** | No implementados. |

**Commits relevantes del producto:**

- `chore: initialize business assistant product from base`
- `docs: add business assistant product MVP spec`
- `docs: add business profile MVP spec`
- `db: add business profiles schema`
- `feat: add business profile API`
- `feat: add business profile UI`
- `feat: inject business profile into chat context`
- `feat: add assistant capability boundaries`
- `feat: add contacts UI` (API/SQL/SPEC en bloques previos del módulo Contacts)
- `feat: add follow-up tasks UI` (API/SQL/SPEC en bloques previos del módulo Follow-up Tasks)
- `feat: add module navigation`

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

### Contacts MVP v1

#### SPEC

- **Archivo:** `docs/spec-contacts-mvp.md`

#### SQL

- **Archivo:** `supabase/product-contacts.sql`
- **Tabla:** `public.contacts` (ejecutado manualmente en Supabase)
- **Campos principales:** `id`, `name`, `email`, `phone`, `source`, `status`, `contact_type`, `interest`, `notes`, `last_contacted_at`, `next_follow_up_at`, `metadata`, `created_at`, `updated_at`

#### API

- **Módulo:** `web/lib/contacts/types.ts`, `validate-input.ts`, `persistence.ts`
- **Ruta:** `web/app/api/contacts/route.ts`
- **Endpoints:**
  - `GET /api/contacts` — hasta 50 contactos recientes (`created_at` desc)
  - `POST /api/contacts` — crea contacto validado
- **Reglas:** `name` obligatorio; `status` y `contact_type` validados; fechas ISO o `null`; `metadata` objeto plano; 400 input inválido; 500 errores seguros.

#### UI

- **Archivo:** `web/app/contacts/page.tsx`
- **Ruta:** `/contacts`
- **Comportamiento:** carga y listado; estado vacío; formulario de creación; validación de `name` en UI; estados loading/saving/error/éxito; nuevo contacto arriba; persiste tras recargar; nota de privacidad (no datos clínicos sensibles).

**Sin integración con chat ni automatizaciones en este MVP.**

### Follow-up Tasks MVP v1

#### SPEC

- **Archivo:** `docs/spec-follow-up-tasks-mvp.md`

#### SQL

- **Archivo:** `supabase/product-follow-up-tasks.sql`
- **Tabla:** `public.follow_up_tasks` (ejecutado manualmente en Supabase)
- **Campos principales:** `id`, `contact_id`, `title`, `description`, `status`, `priority`, `due_at`, `completed_at`, `source`, `metadata`, `created_at`, `updated_at`
- **Relación:** `contact_id` opcional → `public.contacts(id)` ON DELETE SET NULL

#### API

- **Módulo:** `web/lib/follow-up-tasks/types.ts`, `validate-input.ts`, `persistence.ts`
- **Ruta:** `web/app/api/follow-up-tasks/route.ts`
- **Endpoints:**
  - `GET /api/follow-up-tasks` — hasta 50 tareas recientes (`created_at` desc)
  - `POST /api/follow-up-tasks` — crea tarea validada
- **Reglas:** `title` obligatorio; `contact_id` opcional (UUID válido); `status`, `priority` y `source` validados; fechas ISO o `null`; `metadata` objeto plano; 400 input inválido; 500 errores seguros.

#### UI

- **Archivo:** `web/app/follow-up-tasks/page.tsx`
- **Ruta:** `/follow-up-tasks`
- **Comportamiento:** carga y listado; estado vacío; formulario de creación; select de contacto vía `GET /api/contacts`; validación de `title` en UI; `due_at` desde `datetime-local` → ISO; estados loading/saving/error/éxito; nueva tarea arriba; persiste tras recargar; nota de privacidad (no datos clínicos sensibles).

**Sin integración con chat ni automatizaciones en este MVP.**

### Navigation MVP

- **Componente:** `web/components/module-nav.tsx` — `ModuleNav` con enlaces `next/link`.
- **Páginas:** `web/app/chat/page.tsx`, `business-profile/page.tsx`, `contacts/page.tsx`, `follow-up-tasks/page.tsx`.
- **Rutas enlazadas:** `/chat`, `/business-profile`, `/contacts`, `/follow-up-tasks`.
- **Comportamiento:** barra superior simple (Tailwind zinc); visible en las cuatro páginas; sin dashboard, sin sidebar compleja, sin estado activo de ruta, sin dependencias nuevas.
- **Alcance:** solo UI de navegación; **no** se tocó lógica de negocio, APIs ni SQL.

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
| `GET /api/contacts` | Lista contactos (vacía o con datos). |
| `POST /api/contacts` | Crea contacto válido; 400 si input inválido. |
| `/contacts` | Carga, crea contacto (p. ej. «Paciente UI prueba»), aparece en lista y persiste tras recargar. |
| `GET /api/follow-up-tasks` | Lista tareas (vacía o con datos). |
| `POST /api/follow-up-tasks` | Crea tarea válida; 400 si input inválido. |
| `/follow-up-tasks` | Carga, crea tarea (p. ej. «Llamar a paciente UI prueba»), asocia contacto opcional, aparece en lista y persiste tras recargar. |
| Navegación `ModuleNav` | Visible en `/chat`, `/business-profile`, `/contacts`, `/follow-up-tasks`; enlaces funcionan entre módulos y vuelta a Chat. |

---

## Claude Activation Checkpoint

Checkpoint tras **Controlled Claude Activation** y **Assistant Capability Boundaries MVP**.

### 1. Activación de Claude

- **Proveedor IA actual:** Claude (`AI_PROVIDER=claude`).
- **Modelo:** `claude-haiku-4-5`.
- La API key está en `web/.env.local` (solo entorno local); **no** debe imprimirse, leerse en chats ni documentarse aquí.
- La activación fue **manual y local** por el usuario del producto.

### 2. Verificación realizada

| Prueba | Resultado |
|--------|-----------|
| `GET /api/ai/status` | `provider: claude`, `model: claude-haiku-4-5`, `has_api_key: true` (sin exponer la clave). |
| `POST /api/chat/turn` / `/chat` | Respuesta con Claude real (no stub). |
| Business Profile en contexto | Claude usó el perfil guardado. |
| Reconocimiento del negocio | Clínica dental (perfil de prueba). |
| Servicios del perfil | Ortodoncia, dolor dental, radiografías reflejados en la respuesta. |
| Persistencia | Conversación y mensajes siguieron guardándose en Supabase. |

### 3. Corrección de límites de capacidades

- **Problema detectado:** Claude podía describir WhatsApp, web pública u otras integraciones como si ya estuvieran activas.
- **Cambio:** bloque **Current product capabilities** en el system prompt (`web/lib/chat/chat-engine.ts`, commit `feat: add assistant capability boundaries`).
- **Comportamiento esperado:** el asistente distingue entre:
  - **Capacidades actuales** — chat local, contexto de Business Profile, redacción/razonamiento/planificación en conversación.
  - **Ayuda para planificar procesos** — borradores, flujos sugeridos, mensajes tipo plantilla (sin ejecutar integraciones).
  - **Integraciones futuras** — WhatsApp, agenda, CRM, etc. como planificables o implementables más adelante, sin afirmar que ya están conectadas.

### 4. Capacidades actuales reales

El producto **sí** puede hoy:

- Responder en `/chat` con Claude (o stub si se configura).
- Usar el **Business Profile** más reciente como contexto interno del turno.
- Ayudar a **redactar, razonar, resumir, planificar** y **sugerir workflows** en texto.
- **Persistir** conversaciones y mensajes en Supabase.
- Usar **resumen acumulado** y **ventana reciente** de mensajes (heredado de la base).
- Listar conversaciones y títulos en UI (heredado de la base).

### 5. Capacidades NO implementadas todavía

El producto **no** tiene aún (no debe presentarse como activo):

| Área | Estado |
|------|--------|
| WhatsApp | No implementado |
| Web widget público | No implementado |
| Email conectado | No implementado |
| Calendar / agenda real | No implementado |
| CRM real | No implementado |
| Pagos / billing | No implementado |
| Llamadas telefónicas | No implementado |
| Voz | No implementada |
| n8n activo para negocio | Desactivado (`AUTOMATIONS_ENABLED=false`) |
| Automatizaciones externas reales | No implementadas |
| Contacts MVP (listar/crear manual) | Implementado |
| Follow-up Tasks MVP (listar/crear manual) | Implementado |
| Edición/búsqueda/automatización de contactos o tareas | No implementados |
| Navegación entre módulos | Implementada (`ModuleNav`) |
| Product Demo SPEC (guion Zoom) | No documentada |

### 6. Próximo paso (referencia)

Ver sección **Recommended Next Step** más abajo: **Product Demo SPEC**.

---

## Contacts MVP Checkpoint

Checkpoint tras completar **Contacts MVP v1** (SPEC, SQL, API mínima, UI `/contacts`).

### 1. Estado actual

- **Contacts MVP v1 completado.**
- SPEC creada (`docs/spec-contacts-mvp.md`).
- SQL creado y **ejecutado manualmente** en Supabase (`public.contacts`).
- API mínima **GET/POST** implementada.
- UI mínima **`/contacts`** implementada.
- **No** hay integración con chat todavía.
- **No** hay automatizaciones todavía.

### 2. Qué permite hacer ahora

- Listar contactos recientes.
- Crear contactos manualmente desde la UI.
- Guardar datos **administrativos/comerciales mínimos** (nombre, email, teléfono, fuente, estado, tipo, interés, notas, próximo seguimiento).
- Registrar interés, fuente, estado, tipo, notas y fecha de próximo seguimiento.

### 3. Qué NO permite todavía

- Editar contactos.
- Eliminar contactos.
- Ver detalle individual.
- Buscar o filtrar.
- Integrarse con chat.
- Detectar leads automáticamente.
- Enviar WhatsApp o email.
- Agendar citas reales.
- Crear tareas de seguimiento automáticamente.
- Ejecutar automatizaciones (n8n u otras).

### 4. Seguridad y privacidad

- **Contacts MVP no debe usarse para historia clínica.**
- **No** guardar diagnósticos ni tratamientos clínicos.
- **No** guardar documentos identificativos ni tarjetas de pago.
- **Minimizar** datos personales; `notes` e `interest` solo para contexto comercial/administrativo.
- **No** enviar el listado completo de contactos a Claude salvo necesidad explícita en fases futuras (contexto mínimo).
- Mantener **control humano** sobre cualquier seguimiento o acción futura.

### 5. Próximo paso (referencia)

Ver **Recommended Next Step**: **Product Demo SPEC**.

---

## Follow-up Tasks MVP Checkpoint

Checkpoint tras completar **Follow-up Tasks MVP v1** (SPEC, SQL, API mínima, UI `/follow-up-tasks`).

### 1. Estado actual

- **Follow-up Tasks MVP v1 completado.**
- SPEC creada (`docs/spec-follow-up-tasks-mvp.md`).
- SQL creado y **ejecutado manualmente** en Supabase (`public.follow_up_tasks`).
- API mínima **GET/POST** implementada.
- UI mínima **`/follow-up-tasks`** implementada.
- Relación opcional con **contacts** funcionando desde la UI (select cargado con `GET /api/contacts`).
- **No** hay integración con chat todavía.
- **No** hay automatizaciones todavía.

### 2. Qué permite hacer ahora

- Listar tareas recientes.
- Crear tareas manualmente desde la UI.
- Asociar una tarea a un contacto existente (opcional).
- Registrar título, descripción, estado, prioridad, fecha de vencimiento y fuente.
- Guardar tareas **administrativas/comerciales mínimas**.
- Ver persistencia tras recargar la página.

### 3. Qué NO permite todavía

- Editar tareas.
- Eliminar tareas.
- Marcar tareas como completadas desde la UI.
- Ver detalle individual.
- Buscar o filtrar.
- Integrarse con chat.
- Sugerir tareas automáticamente desde conversaciones.
- Enviar WhatsApp o email.
- Crear eventos de calendario.
- Ejecutar automatizaciones (n8n u otras).
- Notificar vencimientos.

### 4. Seguridad y privacidad

- **Follow-up Tasks MVP no debe usarse para historia clínica.**
- **No** guardar diagnósticos ni tratamientos clínicos.
- **No** guardar documentos identificativos ni tarjetas de pago.
- **Minimizar** datos personales en `title` y `description`.
- **No** enviar el listado completo de tareas a Claude salvo necesidad explícita en fases futuras (contexto mínimo).
- Mantener **control humano** sobre cualquier seguimiento o acción futura.
- Las tareas son **administrativas/comerciales**, no clínicas.

### 5. Próximo paso (referencia)

Ver **Recommended Next Step**: **Product Demo SPEC**.

---

## Navigation MVP Checkpoint

Checkpoint tras completar **Navigation MVP — minimal module navigation**.

### 1. Estado actual

- **Navigation MVP completado.**
- Componente reutilizable **`ModuleNav`** creado (`web/components/module-nav.tsx`).
- Navegación añadida a las **cuatro páginas principales** (`/chat`, `/business-profile`, `/contacts`, `/follow-up-tasks`).
- **No** se creó dashboard complejo.
- **No** se tocó lógica de negocio de los módulos.
- **No** se tocaron APIs.
- **No** se tocó SQL ni Supabase.

### 2. Qué permite hacer ahora

- Moverse entre `/chat`, `/business-profile`, `/contacts` y `/follow-up-tasks`.
- Usar el producto como **demo navegable** sin escribir URLs manualmente.
- Presentar el flujo del producto en una **llamada de Zoom** (recorrido por módulos).

### 3. Qué NO permite todavía

- Dashboard completo.
- Auth o menú por roles.
- Navegación avanzada o estado activo de ruta.
- Landing pública o despliegue documentado aquí.
- Integración con WhatsApp, email o calendar.
- Automatizaciones (n8n u otras).

### 4. Nivel del producto

- **`CURSOR.p1`** = **Nivel 1** / base congelada y reutilizable.
- **`business-assistant-mvp`** = **Nivel 2** / producto demo genérico para pequeños negocios (clínica dental como caso de prueba inicial).
- **Todavía no** es una implementación para una empresa concreta ni la web propia del usuario final.
- La **web propia** o un **cliente piloto** deben ser **Nivel 3** y decidirse después de validar la demo.

### 5. Próximo paso (referencia)

Ver **Recommended Next Step**: **Product Demo SPEC**.

---

## Security Notes

- **No imprimir** `web/.env.local` ni pegar claves en chats o documentación.
- **Supabase service role** — solo server-side (`createSupabaseServerClient()` en rutas/lib servidor).
- **Claude API key** — solo server-side en `web/.env.local`; activada localmente en este checkpoint; no documentar ni imprimir el valor.
- **n8n webhook secret** — solo server-side; no activar n8n sin decisión explícita.
- **Contexto al modelo** — ventana reciente acotada + summary; **no** enviar historial completo a proveedores de IA.
- **Business Profile en chat** — bloque compacto; sin loguear payloads completos ni secretos.
- **Contacts** — no almacenar datos clínicos sensibles; no volcar contactos completos al modelo; seguimiento con confirmación humana.
- **Follow-up tasks** — no almacenar datos clínicos sensibles en tareas; no volcar listados completos al modelo; confirmación humana antes de acciones externas.
- **Errores de API** — mensajes seguros al cliente; sin exponer errores crudos de Supabase.

---

## Out of Scope Right Now

No forman parte del estado actual ni del siguiente paso documentado aquí:

- Edición/búsqueda/automatización de contactos o tareas; integración contacts/tasks ↔ chat
- Product Demo SPEC (guion, datos ficticios, qué mostrar en Zoom)
- WhatsApp, voz, email, calendar
- Billing, dashboard complejo
- Multi-tenant, auth avanzada
- Automatizaciones irreversibles, agentes autónomos
- Dominios sensibles: fiscalidad, legal, médico

---

## Recommended Next Step

**Bloque recomendado:** **Product Demo SPEC**

Objetivo del siguiente bloque (solo documentación / diseño):

1. Definir **cómo presentar el MVP en Zoom** (orden de pantallas y mensajes clave).
2. Definir **discurso de demo** y tono comercial (sin prometer integraciones no activas).
3. Definir **negocio de prueba** (p. ej. clínica dental genérica) y **datos ficticios** coherentes.
4. Definir **qué mostrar** (chat + perfil + contactos + tareas + navegación) y **qué no mostrar** (`.env`, Supabase, n8n, APIs internas).
5. **No** crear código todavía.

**Completado en bloques anteriores (referencia):** Controlled Claude Activation, Assistant Capability Boundaries MVP, Contacts MVP v1, Follow-up Tasks MVP v1, Navigation MVP.

---

## GitHub Private Push Checkpoint

Checkpoint tras el **primer push** del producto a un **repositorio privado** en GitHub (`origin` → `main`).

### 1. Estado

| Ítem | Estado |
|------|--------|
| Repo privado en GitHub | Creado: `https://github.com/lahernandezda-web/business-assistant-mvp` |
| Remoto `origin` | Configurado apuntando al repo privado |
| Rama local | `main` |
| Primer push | Completado a `origin/main` |
| Tracking | Rama local `main` trackea `origin/main` |
| Working tree | Limpio después del push |

**Commits relevantes recientes (referencia):**

- `b757952` — fix: harden assistant capability boundaries
- `315ec0f` — docs: add demo seed checklist
- `17abd56` — docs: add product demo MVP spec
- `d7cd176` — docs: add navigation MVP checkpoint
- `0a76415` — feat: add module navigation

### 2. Seguridad

- `web/.env.local` **no fue leído** durante la preparación ni el push.
- `web/.env.local` está **ignorado** por `web/.gitignore` (regla `.env*.local`).
- Solo están versionadas **plantillas** (`.env.example`, `web/.env.example`).
- **No** se subieron claves reales ni archivos `.env` / `.env.local` de entorno.
- **No** se subieron `node_modules`, `.next` ni logs.
- **`CURSOR.p1`** no fue tocado; la base permanece congelada.

### 3. Estado funcional del MVP

| Área | Estado |
|------|--------|
| Business Profile | Funcionando |
| Chat con Claude | Funcionando (local) |
| Contexto de negocio en chat | Funcionando (inyección desde perfil más reciente) |
| Assistant Capability Boundaries | Endurecido (`b757952`) |
| Contacts MVP | Funcionando |
| Follow-up Tasks MVP | Funcionando |
| Navegación (`ModuleNav`) | Funcionando |
| Lint (`npm run lint` desde `web/`) | OK |
| TypeScript (`npx tsc --noEmit` desde `web/`) | OK |
| Final MVP Review | Superado |
| Product Demo SPEC | Creada |
| Demo Seed Checklist | Creado |

### 4. Límites actuales

| Área | Estado |
|------|--------|
| n8n | Desactivado (`AUTOMATIONS_ENABLED=false`) |
| WhatsApp | No implementado |
| Email / calendar | No implementados |
| Voz | No implementada |
| Deployment | No hay |
| CRM completo | No es CRM completo |
| Sistema clínico | No es sistema clínico |
| Datos sensibles reales | **No** debe usarse con datos reales sensibles |

### 5. Decisión arquitectónica

**`business-assistant-mvp`** queda definido como **Nivel 2** — producto demo genérico para pequeños negocios, ahora **respaldado en GitHub privado**.

Cualquier **Nivel 3** futuro debe decidirse **explícitamente** antes de mezclar:

- web propia del usuario;
- cliente piloto;
- implementación real;
- demo vertical dental;
- producto SaaS deployable.

### 6. Próximos pasos posibles

- Preparar **demo manual** con datos ficticios (ver Product Demo SPEC y Demo Seed Checklist).
- **Limpiar datos de verificación** en Supabase si se desea (opcional).
- **Decidir Nivel 3** (web propia, piloto, vertical, SaaS, etc.).
- Crear **repo separado** para implementación real (sin mezclar con esta demo genérica).
- Preparar **deployment** solo con decisión explícita y checklist de secretos.
- Activar **n8n** solo con SPEC previa y `AUTOMATIONS_ENABLED` deliberado.
