# Spec: Business AI Assistant MVP (primer mini producto SaaS piloto)

**Tipo:** especificación y diseño (PLAN / SPEC).  
**Estado:** diseño aprobado para futura implementación; **no** implementado en el repositorio en el momento de redactar esta spec.  
**Motor base:** ver checkpoint en `docs/current-state.md` (Next.js en `web/`, Claude en servidor, Supabase, historial, lista, contexto, summaries, títulos automáticos, UI de `/chat` pulida).

**Metodología:** avanzar en bloques pequeños con **PLAN → SPEC → BUILD → VERIFY**; esta spec es el artefacto SPEC del producto piloto, no código ni migraciones.

---

## 1. Objetivo

**Business AI Assistant MVP** es el **primer mini producto SaaS piloto** planteado encima del motor conversacional ya existente.

Permite que un **negocio pequeño** defina un perfil con instrucciones básicas (nombre, descripción, tono, servicios, FAQs, instrucciones específicas) y que el **mismo flujo de chat persistente** (`/chat`, `POST /api/chat/turn`, summaries, títulos, lista con preview) responda **alineado a ese perfil**, sin reimplementar el núcleo conversacional.

Objetivos de validación del piloto:

- Demostrar que el motor puede **adaptarse a un negocio concreto** vía configuración.
- Demostrar que las **instrucciones del negocio** pueden persistirse y leerse en servidor.
- Demostrar que el **system prompt** puede incorporar un bloque **compacto** de configuración del negocio sin romper el patrón actual: **summary acumulado + últimos 6 mensajes** + actualizaciones `title_update` / `summary_update`.
- Entregar un **producto demostrable** (demo interna o con cliente piloto) reutilizando persistencia de conversaciones ya existente.

Ejemplos de negocios objetivo a medio plazo (no todos en el primer MVP): clínica dental, residencia de mayores, consulta médica privada, academia online, gestoría, centro de estética, empresa de servicios genérica.

---

## 2. Alcance del MVP

**Incluido (diseño y futura implementación acotada):**

- **Configuración simple de negocio** (un perfil lógico de negocio con campos acotados).
- **Nombre del negocio** (`name`).
- **Descripción breve** del negocio (`description`).
- **Tono de respuesta** (`tone`), p. ej. formal, cercano, técnico breve (valor controlado o texto corto según decisión en BUILD).
- **Servicios o productos principales** (`services`), estructura simple (p. ej. lista en JSON, límites de tamaño en implementación).
- **FAQs básicas** (`faqs`), estructura simple (pregunta/respuesta, número y longitud acotados en implementación).
- **Instrucciones específicas para el asistente** (`instructions`), texto libre pero **acotado en longitud** para el system prompt.
- **Uso del motor de chat actual:** mismos endpoints de turno e historial; mismas tablas de conversaciones/mensajes/summaries/títulos salvo extensión acordada en otra spec/SQL.
- **Persistencia de conversaciones** como hoy.
- **Títulos automáticos** y **summaries** como hoy, sin cambiar el contrato de respuesta salvo documentación explícita en BUILD.
- **Preview y lista de conversaciones** como hoy en UI.

**No incluido en el alcance del MVP** (ver §3); la spec solo delimita el producto piloto mínimo viable sobre el motor actual.

---

## 3. Fuera de alcance

En esta fase de producto piloto **no** se incluye (lista explícita):

- **Auth real** (login, sesiones, OAuth, etc.).
- **Multi-tenant** real (aislamiento por organización en BD con RLS).
- **Pagos** y **billing**.
- **Dashboard** avanzado de analítica o gestión.
- **WhatsApp**, **voz**, **n8n**.
- **RAG**, **embeddings**, **subida de documentos** al modelo.
- **Calendario**, **CRM** integrado.
- **Analytics** producto.
- **Roles de usuario** y **panel admin** complejo.

Cualquier extensión posterior debe ser un **nuevo hito** con spec propia y límites de tokens revisados.

---

## 4. Modelo de datos propuesto (futuro; no implementar en esta spec)

Se propone una tabla simple **`business_profiles`** (nombre tentativo; puede ajustarse en BUILD sin cambiar la intención de la spec).

| Campo | Tipo sugerido | Notas |
|--------|----------------|--------|
| `id` | `uuid`, PK | Identificador del perfil. |
| `name` | `text` | Nombre comercial del negocio. |
| `description` | `text` | Descripción breve. |
| `tone` | `text` | Tono deseado (valores acotados recomendados en BUILD). |
| `services` | `jsonb` | Lista estructurada de servicios/productos (límite de ítems y caracteres en BUILD). |
| `faqs` | `jsonb` | FAQs en formato estructurado (p. ej. array de `{q,a}`). |
| `instructions` | `text` | Instrucciones específicas del asistente. |
| `created_at` | `timestamptz` | Auditoría mínima. |
| `updated_at` | `timestamptz` | Auditoría mínima. |
| `metadata` | `jsonb` | Opcional: etiquetas, idioma por defecto, etc., sin abusar del tamaño. |

**Aclaración:** este esquema es **propuesta para una fase BUILD futura**. Esta spec **no** autoriza crear tablas, migraciones ni tocar Supabase hasta que exista el bloque correspondiente del plan de implementación y revisión de tokens.

---

## 5. Integración con el chat actual (futuro)

En una fase **BUILD** posterior (no en esta spec):

1. **`POST /api/chat/turn`** (o capa interna equivalente, p. ej. `chat-engine`) **cargaría el `business_profile` activo** según la estrategia del §6 (p. ej. un único ID fijo o fila seed).
2. Se **construiría o ampliaría el system prompt** con un bloque **compacto y acotado** derivado del perfil: nombre, descripción, tono, lista resumida de servicios, FAQs **truncadas o en número limitado**, instrucciones. Las reglas de tamaño deben fijarse en código (constantes) en BUILD.
3. A continuación el flujo **se mantiene** como hoy:
   - **Summary acumulado** (si existe).
   - **Últimos 6 mensajes** (`CONTEXT_MESSAGE_LIMIT = 6` salvo decisión documentada de cambio).
   - Tras la respuesta: **`title_update`**, **`summary_update`**, persistencia de mensajes.

No se reenvía el historial completo al modelo; no se sustituye el summary por el perfil completo: el perfil es **contexto estático de negocio** en system prompt, no sustituto de la memoria conversacional.

---

## 6. Estrategia MVP sin auth

Para la **primera versión demostrable**:

- **Un único `business_profile`** activo: fila **fija**, **seed** en desarrollo, o variable de entorno que apunte a un `id` concreto (sin exponer secretos en cliente).
- **Sin usuarios** y **sin tenants**: todas las conversaciones siguen el modelo actual de persistencia; el aislamiento por negocio se simula con “solo hay un perfil”.
- Objetivo: **validar producto y tono** con mínima superficie de seguridad y sin multi-tenant.
- **Migración futura:** cuando exista auth/multi-tenant, el perfil activo pasaría a resolverse por `tenant_id` / `user_id` y RLS; el diseño de `metadata` puede reservar claves sin implementarlas ahora.

---

## 7. UI propuesta (futuro; no implementar en esta spec)

- **`/chat`** sigue siendo el **chat principal** del producto piloto.
- Nueva ruta sugerida (una sola en BUILD): **`/settings/business`** o **`/business-profile`** para **editar** el perfil del negocio.
- Contenido de pantalla: formulario con campos básicos (nombre, descripción, tono, servicios, FAQs, instrucciones), **vista previa** de cómo se vería el bloque resumido en prompt (solo lectura o modal), **botón Guardar** que persista vía API dedicada (a definir en spec de API en BUILD).

**Aclaración:** ninguna de estas pantallas ni rutas se implementa como parte de **esta** spec; solo se documenta la intención.

---

## 8. Reglas de tokens

- **No** enviar FAQs completas ilimitadas: **capar** número de entradas y longitud por entrada; opcionalmente incluir solo las FAQs más relevantes (p. ej. top N por orden fijo o por selección manual en UI futura).
- **Limitar** el bloque de perfil de negocio en el system prompt a un **máximo de caracteres/tokens** definido en constantes en servidor (revisar con un mensaje de sistema de referencia).
- **No** meter documentos largos ni PDFs en el MVP.
- **No RAG** en este piloto.
- Mantener el patrón actual: **summary + últimos 6 mensajes**; el perfil no debe empujar fuera de la ventana de forma descontrolada (si el perfil crece, truncar con política explícita y log seguro sin datos sensibles).

---

## 9. Plan de implementación futuro (bloques pequeños)

| Bloque | Contenido |
|--------|-----------|
| **1 — Spec y decisiones** | Congelar esta spec, acotar límites numéricos (chars FAQs, servicios), elegir ruta UI y nombre de tabla. |
| **2 — SQL `business_profiles`** | Script/migración en `supabase/schema.sql` o archivo dedicado; seed opcional; **sin** mezclar con RLS hasta fase posterior. |
| **3 — Persistence** | Funciones en capa de persistencia (p. ej. `getActiveBusinessProfile`, `upsertBusinessProfile`) solo servidor. |
| **4 — UI básica** | Página de edición de perfil + API route mínima para leer/escribir perfil (validación y tamaños). |
| **5 — Cargar perfil en `/api/chat/turn`** | Resolver perfil activo antes de llamar al motor; pasar estructura al constructor de prompt. |
| **6 — Adaptar system prompt** | Concatenar bloque compacto de negocio con el system prompt existente; tests manuales de regresión en tono. |
| **7 — Verificación** | Caso **negocio demo** (§10): conversaciones reales, `title_update` / `summary_update` OK, contexto compacto intacto, `npm run lint` y `npx tsc --noEmit` OK. |
| **8 — Documentación** | Actualizar `docs/current-state.md`, `docs/roadmap.md` y enlace desde arquitectura si aplica. |

Los bloques pueden subdividirse en PRs pequeños; no refactorizar el motor completo en un solo cambio.

---

## 10. Negocio demo recomendado

**Recomendación inicial:** **«Clínica Dental Demo»**.

Motivos:

- Permite probar **horarios**, **servicios** (limpieza, ortodoncia, urgencias), **FAQs** frecuentes, **tono profesional y cercano**.
- Permite fijar **límites** claros: no diagnóstico médico, no prescripciones, **derivación a contacto humano** / cita presencial.
- Es reconocible para demos con stakeholders no técnicos.

Queda **explícito** que el perfil demo puede **sustituirse** por otro negocio (gestoría, academia, etc.) sin cambiar la arquitectura del MVP, solo el contenido seed y los textos de prueba.

---

## 11. Riesgos

| Riesgo | Mitigación sugerida (en BUILD) |
|--------|----------------------------------|
| **System prompt demasiado largo** | Límites estrictos por campo; truncamiento visible en UI de preview; constantes de max chars. |
| **Respuestas inventadas** sobre el negocio | Instrucciones explícitas: «no inventar precios/políticas no definidas en el perfil»; perfil debe incluir solo datos aprobados; revisión humana del seed. |
| **Falta de límites de seguridad** | Disclaimer en instrucciones; no dar consejo médico/legal definitivo; derivación a humano; scope sin auth implica no exponer datos sensibles en el perfil de demo. |
| **Mezclar perfil de negocio con memoria conversacional** | Mantener perfil solo en system (o prefijo fijo); no sustituir summary; no duplicar FAQs enteras en cada turno si ya están acotadas en system. |
| **Sobrecomplicar con multi-tenant** antes de validar | Fase 1 con un solo perfil (§6). |
| **Saltar a WhatsApp** antes de producto web básico | Roadmap explícito: validar web + perfil antes de canales. |

---

## 12. Criterios de éxito (futura implementación)

La implementación del Business AI Assistant MVP se considerará **exitosa** cuando:

- Exista un **perfil de negocio** persistido y **cargable** (editable en UI o al menos cargado por seed), con los campos acordados.
- El **chat** responda de forma coherente con **tono y datos** del negocio definidos en el perfil (validación manual y, si existe, checklist de demo).
- Las **conversaciones** sigan **guardándose** como en el motor actual.
- **`title_update`** siga funcionando como hoy.
- **`summary_update`** siga funcionando como hoy.
- **No se rompa** el patrón de **contexto compacto** (summary + últimos 6 mensajes, sin historial completo al modelo).
- **`npm run lint`** y **`npx tsc --noEmit`** sigan pasando en `web/`.

---

## Documentos relacionados

- `docs/current-state.md` — estado del motor base.
- `docs/roadmap.md` — fases y prioridades globales.
- `docs/architecture.md`, `docs/api-endpoints.md`, `docs/database-schema.md` — referencias para alinear BUILD sin duplicar aquí el detalle de columnas existentes.

---

*Esta spec no modifica código, variables de entorno, Supabase ni dependencias; solo define el diseño del primer mini producto SaaS piloto sobre el motor conversacional.*
