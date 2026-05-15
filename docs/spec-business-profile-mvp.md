# Business Profile MVP Spec

**Tipo:** especificación técnica del primer módulo de producto.  
**Estado:** SPEC inicial — **sin implementación** (sin SQL ejecutado, sin endpoints, sin UI, sin inyección en chat).  
**Producto:** Business Assistant MVP (`business-assistant-mvp`).  
**Base congelada de referencia:** `CURSOR.p1` (no modificar).

---

## 1. Purpose

**Business Profile** es el **primer módulo específico del producto** Business Assistant MVP. No forma parte de la base reutilizable (motor conversacional, persistencia genérica de conversaciones, summaries, títulos, capa de proveedor de IA ni cliente de automatizaciones).

Su función es **guardar información básica de un negocio** (nombre, sector, servicios, tono, cliente objetivo, etc.) para que, en fases posteriores, el asistente pueda **responder con ese contexto comercial** sin inventar datos del negocio.

Este documento define **qué** construir y **cómo** encajarlo en el producto. La implementación (SQL, API, UI, integración con chat) queda para fases siguientes.

---

## 2. Product Boundary

### BASE (reutilizable — no es dominio Business Profile)

| Capacidad | Descripción |
|-----------|-------------|
| Chat engine | Turnos, validación, flujo de chat |
| Persistencia de conversaciones | `conversations`, `messages` |
| Summaries | Resumen acumulado por conversación |
| Titles | Títulos automáticos de conversación |
| Provider layer | IA (p. ej. stub, Claude) server-side |
| Automation client | Cliente genérico hacia n8n |
| Diagnostics | Respuestas sin secretos |

La base **no** almacena ni interpreta el perfil comercial del negocio.

### PRODUCTO (Business Assistant — dominio de este módulo)

| Área | Descripción |
|------|-------------|
| Business profile | Datos básicos del negocio persistidos en Supabase |
| Contexto comercial | Información que condicionará respuestas del asistente |
| Futura personalización de prompt | Bloque de contexto derivado del perfil |
| Futura detección de leads | Fuera de este MVP |
| Futuras tareas de seguimiento | Fuera de este MVP |

**Regla:** el motor de chat sigue en la base; el producto **añade** tabla, persistencia, API mínima y UI simple encima, sin duplicar el núcleo conversacional.

---

## 3. MVP Scope

### Incluido en este MVP (cuando se implemente)

- Crear tabla `public.business_profiles`.
- Permitir **guardar** un perfil básico (create/update simple).
- Permitir **leer** el perfil actual (el que se use operativamente en MVP).
- **Preparar** (diseño documentado) la futura inyección del perfil en el contexto del chat; no implementarla en la primera entrega de persistencia/API/UI.
- Mantener un diseño **simple** (una tabla, pocas funciones server-side, formulario mínimo).

### Excluido explícitamente (por ahora)

| Excluido | Motivo |
|----------|--------|
| `contacts` | Módulo posterior |
| `leads` | Módulo posterior |
| `follow_up_tasks` | Módulo posterior |
| Eventos n8n de negocio | Automatizaciones desactivadas / fuera de alcance |
| WhatsApp | Canal futuro |
| Auth | Sin usuarios ni sesiones en MVP |
| Multi-tenant | Sin `tenant_id` ni aislamiento por organización |
| Roles y permisos | Sin RBAC |
| Panel / dashboard complejo | Solo formulario mínimo |

---

## 4. Data Model

### Tabla propuesta

`public.business_profiles`

| Columna | Tipo | Restricciones | Descripción |
|---------|------|---------------|-------------|
| `id` | `uuid` | PK, `default gen_random_uuid()` | Identificador único del perfil |
| `name` | `text` | `not null` | Nombre comercial del negocio (obligatorio) |
| `industry` | `text` | nullable | Sector o industria (p. ej. clínica, consultoría) |
| `description` | `text` | nullable | Descripción breve del negocio y propuesta de valor |
| `target_customer` | `text` | nullable | Cliente ideal o segmento objetivo |
| `tone` | `text` | nullable | Tono de comunicación deseado (formal, cercano, técnico, etc.) |
| `services` | `text` | nullable | Servicios o productos principales; ver nota abajo |
| `location` | `text` | nullable | Ubicación física o área de servicio |
| `website` | `text` | nullable | URL del sitio web (sin validar dominio en MVP) |
| `metadata` | `jsonb` | `not null`, `default '{}'::jsonb` | Campos extra sin migración inmediata |
| `created_at` | `timestamptz` | `not null`, `default now()` | Alta del registro |
| `updated_at` | `timestamptz` | `not null`, `default now()` | Última modificación |

**Nota sobre `services`:** en el MVP se modela como **`text`** (lista o párrafo libre) para **evitar normalizar prematuramente** (sin tabla `services` ni relaciones N:M). Si más adelante hace falta estructura, se puede migrar a JSON en `metadata` o a tablas hijas.

**Nota sobre `metadata`:** permite **extensibilidad** (horarios, idiomas, redes sociales, etiquetas internas) **sin crear más tablas** al inicio. Convención futura: claves en snake_case; no guardar secretos ni PII sensible sin política explícita.

---

## 5. Single Profile vs Multiple Profiles

### Recomendación para MVP

- La tabla **permite múltiples filas** técnicamente (sin restricción de unicidad global).
- La aplicación **opera inicialmente con un solo perfil “activo”**:
  - **Opción A (MVP simple):** usar siempre el perfil con `updated_at` más reciente (o `created_at` si no hay updates).
  - **Opción B (futuro cercano):** campo o convención en `metadata` (p. ej. `"is_default": true`) o selector en UI.
- **No** introducir `tenant_id`, `user_id` ni tablas de membresía en esta fase.
- **No** crear usuarios ni autenticación; el despliegue inicial asume un único negocio / operador de confianza.

**Multi-tenant y auth** se evaluarán en fases posteriores **solo si el producto lo exige** (varios negocios en la misma instancia, equipos, etc.).

---

## 6. Proposed API / Server Functions

> Propuesta de diseño. **No implementar** hasta las fases indicadas en §11.

### Capa de persistencia (servidor)

Ubicación futura sugerida:

`web/lib/business-profile/persistence.ts`

Patrón alineado con `web/lib/chat/persistence.ts`:

- Solo servidor (`createSupabaseServerClient()`).
- Errores como códigos cortos (`not_configured`, `db_error`, `invalid_input`), sin filtrar secretos ni stack traces al cliente.
- **Nunca** usar service role en el navegador.

| Función | Responsabilidad |
|---------|-----------------|
| `getBusinessProfile()` | Devuelve el perfil activo (según regla §5) o `null` si no existe |
| `upsertBusinessProfile(input)` | Crea o actualiza el perfil activo; valida `name` obligatorio |
| `listBusinessProfiles()` | **Opcional / futuro** — listado para selector multi-perfil |

Tipos de entrada/salida: objetos planos con los campos de la tabla (sin exponer filas crudas de Supabase al frontend si no hace falta).

### Endpoints HTTP futuros (simples)

| Método | Ruta | Comportamiento |
|--------|------|----------------|
| `GET` | `/api/business-profile` | `{ profile: BusinessProfile \| null }` |
| `POST` | `/api/business-profile` | Body JSON con campos editables; upsert; devuelve perfil guardado |

Alternativa futura: `PUT` con `id` cuando exista selector multi-perfil. En MVP basta `POST` idempotente sobre el perfil activo.

**Seguridad:** rutas solo en App Router server-side; validación de entrada; sin claves en respuestas.

---

## 7. UI Scope

### Alcance mínimo (fase posterior a API)

- **Ruta posible:** `/business-profile`  
  **Alternativa:** sección colapsable o pestaña dentro de `/chat` en una iteración posterior.
- **Formulario** con campos editables:
  - `name` (requerido)
  - `industry`
  - `description`
  - `target_customer`
  - `tone`
  - `services`
  - `location`
  - `website`
- Acciones: cargar perfil al montar (`GET`), guardar (`POST`), mensaje de éxito/error simple.
- **Sin** dashboard, gráficos, listados de leads ni navegación compleja.
- **Sin** diseño elaborado: reutilizar estilos y layout existentes del producto (formulario + botón guardar).

---

## 8. Future Chat Context Integration

En una fase posterior (Phase 7), el chat **cargará** el business profile y lo añadirá como **bloque de contexto** estructurado, sin reemplazar el system prompt base del motor.

### Orden sugerido de contexto enviado al modelo

1. **System prompt** (instrucciones generales del asistente / producto)
2. **Business profile context block** (campos del perfil, formateados de forma legible)
3. **Conversation summary** (opcional, si existe resumen acumulado)
4. **Recent messages** (ventana acotada — no historial completo)
5. **Current user message**

### Reglas de comportamiento

- **No** enviar historial completo de la conversación al modelo por defecto.
- **No** inventar información del negocio: si un campo falta, el asistente debe **preguntar** o indicar que no tiene ese dato.
- Si el perfil está **incompleto**, priorizar clarificación antes de afirmar detalles comerciales.
- Minimizar tokens: solo campos relevantes y no vacíos cuando sea posible.

Ejemplo conceptual del bloque (ilustrativo, no implementado):

```text
[Business context]
Name: ...
Industry: ...
...
```

---

## 9. Security and Privacy

| Principio | Aplicación |
|-----------|------------|
| Sin secretos en perfil | No guardar API keys, tokens, contraseñas ni credenciales en `business_profiles` |
| Sin datos sensibles innecesarios | Evitar DNI, datos bancarios, salud, etc. en MVP |
| Service role solo servidor | Cliente Supabase con privilegios elevados únicamente en API routes / server lib |
| Variables de entorno | No exponer `.env.local` ni documentar su contenido |
| Contexto al modelo | Enviar solo el bloque de perfil necesario; no volcar `metadata` entero si contiene datos no previstos |
| PII futura de clientes | Si en módulos `contacts`/`leads` se guardan datos de terceros, definir **política de retención y minimización** antes de implementar |

Los errores al usuario deben ser genéricos; los detalles de base de datos quedan en logs server-side sin secretos.

---

## 10. SQL Plan

> **No ejecutar** este SQL en la fase actual. Solo documentación para Phase 2–3.

El proyecto base ya define `public.set_conversations_updated_at()` en `supabase/schema.sql` (misma lógica: `new.updated_at := now()`). Se **reutiliza** para `business_profiles` en lugar de duplicar función, alineado con `conversation_summaries`.

```sql
-- Business Profile MVP (producto) — NO EJECUTAR AÚN

create table if not exists public.business_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  description text,
  target_customer text,
  tone text,
  services text,
  location text,
  website text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índice opcional: listados o “perfil más reciente” por fecha
create index if not exists business_profiles_created_at_idx
  on public.business_profiles (created_at desc);

drop trigger if exists business_profiles_set_updated_at on public.business_profiles;
create trigger business_profiles_set_updated_at
  before update on public.business_profiles
  for each row
  execute function public.set_conversations_updated_at();
```

**Ubicación futura del SQL:** añadir al final de `supabase/schema.sql` o en archivo dedicado del producto (p. ej. `supabase/product-business-profile.sql`) referenciado en documentación de despliegue — decisión en Phase 2.

**Alternativa documentada:** si se prefiere nombre genérico, una función `public.set_updated_at()` podría sustituir a la actual en un refactor de base; **no** es requisito del Business Profile MVP.

---

## 11. Implementation Plan

| Fase | Entregable | Estado |
|------|------------|--------|
| **Phase 1** | Crear esta SPEC (`docs/spec-business-profile-mvp.md`) | En curso / completar con este documento |
| **Phase 2** | Añadir SQL a `supabase/schema.sql` o archivo producto SQL | Pendiente |
| **Phase 3** | Ejecutar SQL manualmente en Supabase (proyecto del producto) | Pendiente |
| **Phase 4** | `web/lib/business-profile/persistence.ts` | Pendiente |
| **Phase 5** | `GET` / `POST` `/api/business-profile` | Pendiente |
| **Phase 6** | UI mínima (`/business-profile` o sección en chat) | Pendiente |
| **Phase 7** | Inyectar business profile en contexto del chat | Pendiente |
| **Phase 8** | Verificar lint, TypeScript y flujo manual en UI | Pendiente |

Entre fases: no activar n8n ni nuevas automatizaciones de negocio; mantener `AI_PROVIDER=stub` válido durante pruebas.

---

## 12. Verification Criteria

Cuando las fases 2–8 estén implementadas, se considerará cumplido el MVP de Business Profile si:

| # | Criterio |
|---|----------|
| 1 | El SQL de §10 se ejecuta en Supabase **sin errores** |
| 2 | La tabla `business_profiles` es visible en el panel de Supabase |
| 3 | `GET /api/business-profile` devuelve `null` o un objeto perfil coherente |
| 4 | `POST /api/business-profile` persiste cambios y actualiza `updated_at` |
| 5 | La UI permite ver y editar los campos del formulario |
| 6 | El chat existente **sigue funcionando** (sin regresiones en turnos/historial) |
| 7 | `AI_PROVIDER=stub` puede permanecer activo para pruebas sin depender del perfil |
| 8 | No se exponen secretos en respuestas API ni en el bloque de contexto |
| 9 | `lint` y comprobación TypeScript del proyecto web **OK** |

Prueba manual sugerida: guardar perfil → recargar UI → enviar mensaje en chat → (tras Phase 7) comprobar que respuestas referencian datos del perfil o piden completar campos faltantes.

---

## 13. Current Status

| Elemento | Estado |
|----------|--------|
| Esta SPEC | Creada en Phase 1 — **solo documentación** |
| Tabla `business_profiles` | **No existe** aún en Supabase |
| SQL en repositorio | **No añadido** a `schema.sql` |
| `web/lib/business-profile/` | **No existe** |
| Endpoints `/api/business-profile` | **No existen** |
| UI de perfil | **No existe** |
| Inyección en prompt del chat | **No implementada** |
| `contacts` / `leads` / `follow_up_tasks` | **Fuera de alcance** |
| Automatizaciones n8n nuevas | **Ninguna** |

El producto sigue operando con la base conversacional existente; Business Profile queda **únicamente especificado**, listo para implementación incremental según §11.
