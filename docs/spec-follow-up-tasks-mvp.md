# Follow-up Tasks MVP Spec

## Purpose

Follow-up Tasks MVP permite guardar **acciones simples de seguimiento** para que el negocio no pierda oportunidades ni tareas pendientes.

Una tarea puede representar, por ejemplo:

- llamar a un contacto;
- responder una consulta;
- preparar un mensaje;
- revisar un caso administrativo;
- hacer seguimiento a un potencial cliente;
- recordar una acción interna.

El objetivo no es un gestor complejo de proyectos ni una automatización autónoma. Es un registro mínimo, visible y accionable, con **control humano** en todo momento: el sistema guarda y muestra; el usuario decide qué hacer y cuándo.

## Product Boundary

- Este módulo pertenece a **business-assistant-mvp** (producto independiente).
- **No** pertenece a CURSOR.p1 (base congelada y completada; no modificar).
- **No** incluye en este MVP: WhatsApp, email saliente, calendario real, agenda externa ni automatizaciones que ejecuten acciones fuera del producto.
- **No** ejecuta acciones automáticamente (no envía mensajes, no agenda citas, no llama).
- **No** reemplaza el criterio humano: las tareas se crean, revisan y completan por el usuario (o, en fase futura, se sugieren por el asistente solo tras confirmación explícita).
- Relación opcional con `public.contacts` cuando exista un contacto asociado; no es obligatorio para crear una tarea.

## MVP User

Usuario objetivo:

- **Pequeño negocio** o autónomo con equipo reducido.
- Caso inicial de prueba: **clínica dental** (seguimiento comercial y administrativo, no clínico).
- Necesita recordar **a quién** responder (opcionalmente vía contacto), **cuándo** hacer seguimiento (`due_at`) y **qué acción** queda pendiente (`title`, `description`).
- No necesita kanban, subtareas, asignaciones multi-equipo ni notificaciones push reales en este MVP.

## Core Use Cases

1. **Crear una tarea manualmente** desde la UI o API (origen `manual`).
2. **Asociar opcionalmente una tarea a un contacto** (`contact_id` nullable → `contacts.id`).
3. **Registrar título, descripción y fecha de vencimiento** (`title`, `description`, `due_at`).
4. **Marcar prioridad básica** (`priority`: low, normal, high, urgent).
5. **Marcar estado básico** (`status`: open, in_progress, completed, cancelled, archived).
6. **Listar tareas recientes o pendientes** (filtro por estado abierto / en progreso en implementación futura).
7. **Ver qué tareas están vencidas o próximas** (comparar `due_at` con fecha actual en listado o indicador visual simple).
8. **Fase futura — asistente:** sugerir tareas a partir de conversación o resumir pendientes; **sin** ejecutarlas ni crearlas sin confirmación humana.

## Out of Scope

Explícitamente fuera de Follow-up Tasks MVP:

- Gestor de proyectos completo.
- Kanban avanzado, columnas personalizadas, WIP limits.
- Subtareas, dependencias entre tareas, Gantt.
- Equipos y asignaciones complejas (múltiples responsables, permisos por rol).
- Notificaciones reales (push, SMS, email automático).
- Google Calendar u otras agendas externas.
- Email automático y WhatsApp automático.
- Llamadas automáticas.
- Pagos y facturación.
- **Historia clínica** y cualquier dato clínico sensible.
- **Datos médicos sensibles:** diagnósticos, tratamientos, radiografías, alergias clínicas detalladas, etc.
- Automatizaciones irreversibles y agentes autónomos.
- Integraciones externas (Asana, Trello, HubSpot tasks, etc.).
- Multi-tenant.
- Auth avanzada (roles granulares, SSO, etc.).

**Nota clínica dental:** este MVP solo almacena tareas **administrativas/comerciales** (llamar, responder consulta comercial, preparar presupuesto, seguimiento de lead). **No** debe usarse para historia clínica, notas de tratamiento ni datos clínicos en `title` o `description`.

## Proposed Data Model

Tabla futura sugerida: `public.follow_up_tasks`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `uuid` PK | Identificador único de la tarea. |
| `contact_id` | `uuid` NULL, FK → `public.contacts(id)` ON DELETE SET NULL | Contacto asociado opcional; si se borra el contacto, la tarea permanece sin vínculo. |
| `title` | `text` NOT NULL | Título breve y accionable (ej. "Llamar a María por presupuesto"). |
| `description` | `text` NULL | Detalle opcional; solo texto administrativo/comercial, no clínico. |
| `status` | `text` NOT NULL DEFAULT `'open'` | Estado de la tarea (ver valores sugeridos). |
| `priority` | `text` NOT NULL DEFAULT `'normal'` | Prioridad básica (ver valores sugeridos). |
| `due_at` | `timestamptz` NULL | Fecha/hora límite o recordatorio de seguimiento; opcional. |
| `completed_at` | `timestamptz` NULL | Momento en que se marcó como completada; NULL si no aplica. |
| `source` | `text` NULL | Origen de la tarea (manual, sugerencia de chat, sistema). |
| `metadata` | `jsonb` NOT NULL DEFAULT `'{}'` | Extensiones ligeras sin esquema rígido; no usar para datos sensibles ni clínicos. |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | Alta del registro. |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | Última modificación (trigger o app en implementación). |

### Status sugeridos (MVP)

| Valor | Uso |
|-------|-----|
| `open` | Tarea pendiente sin empezar. |
| `in_progress` | En curso o parcialmente atendida. |
| `completed` | Finalizada; `completed_at` debería rellenarse al marcar. |
| `cancelled` | Descartada sin completar. |
| `archived` | Cerrada o histórica; no borrada. |

No hace falta lógica de transición estricta en MVP; son etiquetas para filtrar y ordenar.

### Priority sugeridos (MVP)

| Valor | Uso |
|-------|-----|
| `low` | Puede esperar. |
| `normal` | Prioridad estándar (default). |
| `high` | Requiere atención pronto. |
| `urgent` | Muy urgente; uso con criterio humano. |

### Source sugeridos (MVP)

| Valor | Uso |
|-------|-----|
| `manual` | Creada por el usuario en UI o API. |
| `chat_suggestion` | Propuesta por el asistente; solo tras confirmación humana al persistir. |
| `system` | Reservado para registros internos futuros (ej. migración, seed). |

No hace falta forzar lógica compleja de `source` en MVP; puede quedar en `manual` por defecto hasta integrar chat.

### Relación con contacts

- Una tarea **puede** tener `contact_id` o `NULL`.
- Un contacto **puede** tener muchas tareas (1:N).
- ON DELETE SET NULL evita borrar tareas al eliminar un contacto (comportamiento conservador para MVP).

## Privacy and Safety Notes

- **Minimizar datos personales:** solo lo necesario en `title`/`description`; evitar DNI, historiales o datos de salud.
- **No** guardar datos médicos sensibles, diagnósticos ni tratamientos clínicos en tareas.
- **No** guardar documentos identificativos ni tarjetas de pago en `description` o `metadata`.
- **No** usar `metadata` para evadir restricciones (no almacenar PHI en JSON).
- **No** enviar el listado completo de tareas a Claude; en integración futura, usar **contexto mínimo** (resumen acotado o tareas seleccionadas bajo petición explícita).
- Cualquier tarea **sugerida por IA** debe requerir **revisión y confirmación humana** antes de crearse o ejecutarse en el mundo real.
- Antes de producción real: revisar requisitos legales (RGPD, retención, derecho de supresión, sector salud si aplica).

## Proposed API

Solo documentación; **no implementar** en este bloque.

### Endpoints futuros

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/follow-up-tasks` | Lista tareas (pendientes/recientes; filtros opcionales en fase posterior). |
| `POST` | `/api/follow-up-tasks` | Crea tarea con campos mínimos. |
| `PATCH` | `/api/follow-up-tasks/:id` | Actualiza campos (fase posterior; marcar completada, cambiar status). |
| `GET` | `/api/follow-up-tasks/:id` | Detalle de una tarea (fase posterior). |

### MVP inicial recomendado

Implementar primero solo:

- `GET /api/follow-up-tasks`
- `POST /api/follow-up-tasks`

`PATCH` para marcar como completada (`status`, `completed_at`) y `GET /api/follow-up-tasks/:id` pueden quedar para la fase siguiente.

### Validaciones básicas (futuro)

- `title` obligatorio y no vacío.
- `status` y `priority` en listas permitidas; defaults `open` y `normal`.
- `contact_id` opcional; si se envía, debe existir en `contacts`.
- `due_at` opcional; formato ISO / timestamptz válido.
- `source` opcional; validar contra valores sugeridos si se envía.
- Sanitizar longitud de `description` (límite razonable, ej. 2000–5000 caracteres).

### Respuestas esperadas (referencia)

- `GET`: `{ tasks: FollowUpTask[] }` o array directo según convención del proyecto (alinear con `contacts` y `business-profile`).
- `POST`: `{ task: FollowUpTask }` con `201` o cuerpo acordado con el resto de APIs del producto.
- Errores: `400` validación, `500` servidor; sin exponer secretos ni stack en producción.

## Proposed UI

Solo documentación; **no implementar** en este bloque.

### Ruta futura

`/follow-up-tasks`

### UI mínima

- **Listado** de tareas abiertas (y opcionalmente en progreso).
- **Indicador o sección** de tareas vencidas (`due_at` &lt; ahora) y próximas (ej. próximos 7 días).
- **Formulario simple** para crear tarea.
- **Selector opcional de contacto** si existen contactos en el sistema (dropdown o búsqueda ligera).
- Campos mínimos visibles:
  - `title`
  - `description`
  - `contact_id` (opcional)
  - `status`
  - `priority`
  - `due_at`
  - `source` (puede ocultarse en UI y fijarse `manual` en MVP)
- Estados: carga, error, guardado correcto, lista vacía.

**No** dashboard complejo, gráficos de productividad ni vista kanban.

### Navegación

Enlazar desde layout o menú principal del producto cuando exista patrón estable (similar a `/contacts` y `/business-profile`).

## Future Chat Integration

En fase posterior, el asistente (`/chat`, `/api/chat/turn`) podría:

- **Sugerir una tarea** a partir de una conversación (borrador para confirmación).
- **Preparar texto de seguimiento** (mensaje o nota para revisión humana).
- **Resumir tareas pendientes** o vencidas (contexto mínimo, no volcar toda la tabla).
- **Ayudar a priorizar** (recomendación verbal, sin cambiar BD sin confirmación).
- **Preguntar antes de crear** una tarea en base de datos.

El asistente **no debe**:

- Crear tareas en BD sin confirmación humana explícita.
- Contactar automáticamente por WhatsApp, email o teléfono.
- Enviar mensajes o agendar citas reales en sistemas externos.
- Ejecutar acciones externas (pagos, citas, recordatorios push).

Integración sugerida: perfil de negocio + resumen acotado de tareas o una tarea concreta; nunca exportar listados completos con datos personales innecesarios.

## Future Automation Integration

**n8n** (u otras herramientas) podrían usarse más adelante, solo con decisión explícita del producto, para:

- enviar notificaciones internas (ej. Slack/email interno del equipo);
- registrar eventos de auditoría;
- avisar de tareas vencidas en canales elegidos;
- crear logs externos.

**No** en este MVP. **Nunca** sin control humano y sin `AUTOMATIONS_ENABLED` (o equivalente) activado de forma consciente. Las automatizaciones no deben marcar tareas como completadas ni contactar clientes sin revisión.

## Implementation Plan

| Fase | Entregable | Estado |
|------|------------|--------|
| 1 | SPEC — este documento | En curso |
| 2 | SQL `public.follow_up_tasks` (migración Supabase) | Pendiente |
| 3 | API mínima `GET` / `POST` `/api/follow-up-tasks` | Pendiente |
| 4 | UI mínima `/follow-up-tasks` (listar + crear) | Pendiente |
| 5 | `PATCH` para marcar tareas como completadas | Pendiente |
| 6 | Integración opcional con chat (sugerencias, confirmación humana) | Pendiente |
| 7 | Automatizaciones futuras solo con control humano explícito | Pendiente |

Orden recomendado: SQL → API → UI → PATCH → chat → automatizaciones.

## Verification Criteria

Cuando se implemente, verificar:

- [ ] SQL ejecutado correctamente en Supabase; tabla `follow_up_tasks` existe con columnas, FK y defaults acordados.
- [ ] `GET /api/follow-up-tasks` devuelve lista (vacía o con datos de prueba).
- [ ] `POST /api/follow-up-tasks` crea tarea y persiste en BD.
- [ ] Validaciones básicas (`title`, status/priority permitidos) funcionan.
- [ ] `/follow-up-tasks` permite crear y listar tareas.
- [ ] Tarea puede asociarse opcionalmente a un contacto existente.
- [ ] Lint OK en proyecto web.
- [ ] TypeScript sin errores en rutas y tipos de tarea.
- [ ] `web/.env.local` no está en git.
- [ ] No se almacenan datos sensibles innecesarios ni clínicos en tareas de prueba.
- [ ] No hay automatizaciones externas activadas (`AUTOMATIONS_ENABLED=false` o equivalente).

## Current Status

| Área | Estado |
|------|--------|
| SPEC | Creada (`docs/spec-follow-up-tasks-mvp.md`) |
| SQL | No implementado |
| API | No implementada |
| UI | No implementada |
| Chat integration | No implementada |
| n8n | No activado |

---

*Documento de especificación únicamente. Producto: business-assistant-mvp. Base CURSOR.p1 no aplica.*
