# Contacts MVP Spec

## Purpose

Contacts MVP permite guardar personas relacionadas con un negocio para futura asistencia, seguimiento y organización básica.

El objetivo no es gestionar un CRM completo, sino ofrecer un registro mínimo y útil: quién contactó, cómo localizarlo, qué interés o consulta expresó, en qué estado está el seguimiento y cuál podría ser el siguiente paso. Esto prepara el producto para que el asistente pueda ayudar con contexto humano revisable, sin ejecutar acciones automáticas todavía.

## Product Boundary

- Este módulo pertenece a **business-assistant-mvp** (producto independiente).
- **No** pertenece a CURSOR.p1 (base congelada; no modificar).
- **No** debe convertirse en un CRM completo: sin pipelines avanzados, campañas, scoring ni automatizaciones irreversibles.
- **No** incluye en este MVP: WhatsApp, email saliente, agenda real, citas confirmadas, pagos, facturación ni integraciones externas.
- **No** incluye multi-tenant ni autenticación avanzada.
- Se mantiene una sola entidad conceptual (`contacts`) con `status` y `contact_type` simples; no separar contacts y leads en tablas distintas salvo necesidad futura demostrada.

## MVP User

Usuario objetivo:

- Pequeño negocio o autónomo con equipo reducido.
- Caso inicial de prueba: **clínica dental** (pacientes potenciales, consultas, seguimiento comercial básico).
- Necesita recordar quién preguntó, por qué canal llegó, qué necesita o le interesa y cuál es el siguiente paso administrativo o comercial.
- No necesita (ni debe tener en MVP) historia clínica, diagnósticos ni documentación médica.

## Core Use Cases

1. **Crear un contacto manualmente** desde la UI (formulario simple).
2. **Guardar nombre y forma de contacto** (teléfono y/o email; al menos uno recomendado en validación futura).
3. **Registrar motivo de consulta o interés** (campo `interest` o notas breves).
4. **Marcar estado básico** (`status`: new, contacted, interested, etc.).
5. **Añadir notas simples** (texto libre en `notes`).
6. **Consultar contactos recientes** (listado ordenado por `created_at` o `updated_at`).
7. **Fase futura — asistente:** sugerir redacción de seguimiento o resumir contexto; **sin** ejecutar contacto automático ni cambios irreversibles sin confirmación humana.

## Out of Scope

Explícitamente fuera de Contacts MVP:

- CRM completo y pipelines comerciales complejos.
- Scoring automático de leads.
- Campañas y email marketing.
- WhatsApp automático o envío de mensajes sin revisión humana.
- Citas reales y agenda integrada.
- Pagos y facturación.
- Consentimientos legales avanzados (RGPD/LOPD detallado, bases legales, DPO workflows).
- **Historia clínica** y cualquier dato clínico sensible.
- **Datos médicos sensibles:** diagnósticos, tratamientos, radiografías, historiales, alergias clínicas detalladas, etc.
- Automatizaciones irreversibles (n8n, envíos masivos, etc.).
- Integraciones externas (HubSpot, Salesforce, etc.).
- Multi-tenant.
- Auth avanzada (roles granulares, SSO, etc.).

**Nota clínica dental:** este MVP solo almacena información **administrativa/comercial mínima** (nombre, contacto, interés comercial, notas no clínicas, fechas de seguimiento). **No** debe usarse para historia clínica ni datos clínicos sensibles.

## Proposed Data Model

Tabla futura sugerida: `public.contacts`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | `uuid` PK | Identificador único del contacto. |
| `name` | `text` NOT NULL | Nombre de la persona o referencia (ej. "María López"). |
| `email` | `text` NULL | Email de contacto; opcional si hay teléfono. |
| `phone` | `text` NULL | Teléfono; opcional si hay email. |
| `source` | `text` NULL | Origen del contacto (web, recomendación, walk-in, chat, etc.). |
| `status` | `text` NOT NULL DEFAULT `'new'` | Estado de seguimiento comercial básico. |
| `contact_type` | `text` NULL | Tipo de relación (lead, customer, patient, etc.). |
| `interest` | `text` NULL | Motivo de consulta o interés (ej. "blanqueamiento", "primera visita"). |
| `notes` | `text` NULL | Notas libres no clínicas. |
| `last_contacted_at` | `timestamptz` NULL | Última vez que se contactó (manual o futuro registro). |
| `next_follow_up_at` | `timestamptz` NULL | Recordatorio opcional de siguiente seguimiento. |
| `metadata` | `jsonb` NOT NULL DEFAULT `'{}'` | Extensiones ligeras sin esquema rígido (evitar datos sensibles). |
| `created_at` | `timestamptz` NOT NULL DEFAULT `now()` | Alta del registro. |
| `updated_at` | `timestamptz` NOT NULL DEFAULT `now()` | Última modificación (trigger o app en implementación). |

### Status sugeridos (MVP)

| Valor | Uso |
|-------|-----|
| `new` | Contacto nuevo sin seguimiento. |
| `contacted` | Ya se ha respondido o contactado. |
| `interested` | Muestra interés activo. |
| `not_interested` | No continúa o declinó. |
| `converted` | Pasó a cliente/paciente (criterio del negocio). |
| `archived` | Cerrado o inactivo; no borrado. |

No hace falta lógica de transición estricta en MVP; son etiquetas para filtrar y ordenar.

### contact_type sugeridos (MVP)

| Valor | Uso |
|-------|-----|
| `lead` | Potencial sin conversión. |
| `customer` | Cliente actual. |
| `patient` | Paciente (contexto clínica; solo dato administrativo). |
| `supplier` | Proveedor o contacto administrativo. |
| `other` | Otros casos. |

Opcional en creación; no forzar reglas de negocio complejas todavía.

### Decisión: una sola tabla

Contacts y leads se unifican en `contacts` con `status` y `contact_type`. Evita duplicar modelos y APIs en MVP. Si más adelante hace falta separar, se documentará migración explícita.

## Privacy and Safety Notes

- **Minimizar datos personales:** solo campos necesarios para seguimiento comercial básico.
- **No** guardar datos médicos sensibles, diagnósticos, tratamientos clínicos ni documentos identificativos (DNI escaneado, etc.).
- **No** guardar tarjetas de pago ni datos financieros en `contacts`.
- **No** enviar el listado completo de contactos a Claude; en integración futura, usar **contexto mínimo** (ej. un contacto o resumen acotado bajo petición explícita).
- `notes` e `interest` deben usarse para texto comercial/administrativo, no clínico.
- `metadata` no debe usarse para evadir restricciones (no almacenar PHI en JSON).
- Antes de producción real: revisar requisitos legales (RGPD, consentimiento, retención, derecho de supresión).

## Proposed API

Solo documentación; **no implementar** en este bloque.

### Endpoints futuros

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/contacts` | Lista contactos (recientes primero; paginación opcional en fase posterior). |
| `POST` | `/api/contacts` | Crea contacto con campos mínimos. |
| `GET` | `/api/contacts/:id` | Detalle de un contacto (fase posterior). |
| `PATCH` | `/api/contacts/:id` | Actualiza campos (fase posterior). |

### MVP inicial recomendado

Implementar primero solo:

- `GET /api/contacts`
- `POST /api/contacts`

`PATCH` y `GET /api/contacts/:id` pueden quedar para una fase posterior (edición y detalle en UI).

### Validaciones básicas (futuro)

- `name` obligatorio y no vacío.
- Al menos uno de `email` o `phone` recomendado (definir en implementación si es obligatorio o solo advertencia).
- `status` en lista permitida; default `new`.
- `contact_type` opcional; si se envía, validar contra valores sugeridos.
- Sanitizar longitud de `notes` e `interest` (límite razonable, ej. 2000–5000 caracteres).

### Respuestas esperadas (referencia)

- `GET`: `{ contacts: Contact[] }` o array directo según convención del proyecto (alinear con `business-profile`).
- `POST`: `{ contact: Contact }` con `201` o cuerpo acordado con el resto de APIs del producto.
- Errores: `400` validación, `500` servidor; sin exponer secretos ni stack en producción.

## Proposed UI

Solo documentación; **no implementar** en este bloque.

### Ruta futura

`/contacts`

### UI mínima

- Listado de contactos recientes (nombre, status, fecha).
- Botón **Crear contacto**.
- Formulario simple: nombre, email, teléfono, source, status, contact_type, interest, notes (campos mínimos visibles; fechas de seguimiento opcionales en fase posterior).
- Estados: carga, error, guardado correcto, lista vacía.

**No** dashboard complejo, gráficos, kanban ni pipeline visual.

### Navegación

Enlazar desde layout o menú principal del producto cuando exista patrón estable (similar a `/business-profile`).

## Future Chat Integration

En fase posterior, el asistente (`/chat`, `/api/chat/turn`) podría:

- Ayudar a **redactar notas de seguimiento** a partir de conversación del usuario.
- **Sugerir el siguiente paso** (ej. "contactar en 3 días").
- **Resumir** interacciones ya descritas en notas (sin inventar datos clínicos).
- **Preparar borradores de mensajes** para revisión humana.

El asistente **no debe**:

- Contactar automáticamente por WhatsApp, email o teléfono.
- Enviar mensajes sin confirmación explícita del usuario.
- Agendar citas reales en sistemas externos.
- Crear, modificar o archivar contactos sin confirmación humana clara (MVP: cambios vía UI/API explícita del usuario).
- Incluir datos clínicos sensibles en prompts.

Integración sugerida: cargar contexto mínimo (perfil de negocio + opcionalmente un contacto seleccionado o resumen), nunca volcar toda la tabla.

## Implementation Plan

| Fase | Entregable | Estado |
|------|------------|--------|
| 1 | SPEC — este documento | En curso |
| 2 | SQL `public.contacts` (migración Supabase) | Pendiente |
| 3 | API mínima `GET` / `POST` `/api/contacts` | Pendiente |
| 4 | UI mínima `/contacts` (listar + crear) | Pendiente |
| 5 | Integración opcional con chat (sugerencias, no acciones) | Pendiente |
| 6 | Automatizaciones futuras solo con confirmación humana | Pendiente |

Orden recomendado: SQL → API → UI → chat → automatizaciones.

## Verification Criteria

Cuando se implemente, verificar:

- [ ] SQL ejecutado correctamente en Supabase; tabla `contacts` existe con columnas y defaults acordados.
- [ ] `GET /api/contacts` devuelve lista (vacía o con datos de prueba).
- [ ] `POST /api/contacts` crea contacto y persiste en BD.
- [ ] Validaciones básicas (`name`, status permitido) funcionan.
- [ ] `/contacts` permite crear y listar contactos.
- [ ] Lint OK en proyecto web.
- [ ] TypeScript sin errores en rutas y tipos de contacto.
- [ ] `web/.env.local` no está en git.
- [ ] No se almacenan datos sensibles innecesarios ni clínicos en notas de prueba.

## Current Status

| Área | Estado |
|------|--------|
| SPEC | Creada (`docs/spec-contacts-mvp.md`) |
| SQL | No implementado |
| API | No implementada |
| UI | No implementada |
| Chat integration | No implementada |
| n8n | No activado |

---

*Documento de especificación únicamente. Producto: business-assistant-mvp. Base CURSOR.p1 no aplica.*
