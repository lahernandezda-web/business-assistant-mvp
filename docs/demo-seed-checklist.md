# Demo Seed Checklist

## Purpose

Este checklist sirve para preparar **manualmente** datos ficticios que demuestren **business-assistant-mvp** en una llamada comercial (por ejemplo, por Zoom).

No es un seed automático, no es un script de base de datos ni un proceso de inserción en Supabase. Todo se carga desde la UI del producto, campo por campo, antes de la demo.

El negocio ficticio principal de esta demo es **Clínica Dental Sonrisa Norte** (A Coruña, España). Usa solo datos inventados para la presentación.

---

## Product Level

| Nivel | Proyecto | Rol |
|-------|----------|-----|
| **Nivel 1** | `CURSOR.p1` | Base congelada y completada. No se modifica. |
| **Nivel 2** | `business-assistant-mvp` | Demo genérica para pequeños negocios (este producto). |
| **Nivel 3** (futuro) | Cliente real, web propia o implementación vertical | Fuera del alcance de este checklist. |

---

## Safety Rules

Antes y durante la preparación de la demo, cumple estas reglas:

- Usar **solo datos ficticios**.
- **No** usar pacientes reales ni nombres reales de personas atendidas.
- **No** usar clientes reales ni empresas reales como ejemplo principal.
- **No** guardar diagnósticos médicos ni clínicos.
- **No** guardar tratamientos ni planes terapéuticos.
- **No** guardar documentos clínicos ni historiales médicos.
- **No** guardar tarjetas de pago ni datos bancarios.
- **No** leer ni mostrar `web/.env.local` (ni imprimir variables de entorno).
- **No** abrir el panel de Supabase durante la demo comercial.
- **No** prometer integraciones que no estén implementadas (WhatsApp, email, calendario, voz, n8n, etc.).

---

## Pre-Demo Technical Check

Completa esto **antes** de cargar datos ficticios. Es uso interno; no lo muestres al cliente salvo necesidad técnica puntual.

### Repo y servidor

- [ ] Abrir el repo correcto: `C:\Users\luish\Desktop\business-assistant-mvp`
- [ ] Confirmar que **no** estás en `CURSOR.p1`
- [ ] Entrar en la carpeta `web/`
- [ ] Arrancar: `npm.cmd run dev`

### Rutas principales (navegador)

- [ ] http://localhost:3000/business-profile
- [ ] http://localhost:3000/chat
- [ ] http://localhost:3000/contacts
- [ ] http://localhost:3000/follow-up-tasks

### Endpoints de estado (solo verificación interna)

- [ ] http://localhost:3000/api/ai/status
- [ ] http://localhost:3000/api/supabase/status
- [ ] http://localhost:3000/api/supabase/tables-status

**Nota:** Estos endpoints son para comprobar que el entorno local responde. No los abras ni los expliques al cliente durante la demo comercial salvo que sea estrictamente necesario para ti.

---

## Step 1 — Business Profile

**Pantalla:** http://localhost:3000/business-profile

Cargar manualmente estos valores y guardar:

| Campo | Valor |
|-------|--------|
| **Name** | Clínica Dental Sonrisa Norte |
| **Industry** | Clínica dental |
| **Location** | A Coruña, España |
| **Tone** | Profesional, claro, cercano y tranquilizador |
| **Description** | Clínica dental enfocada en atención cercana, prevención, diagnóstico inicial y orientación del paciente antes de la consulta presencial. |
| **Target customer** | Personas que necesitan resolver dudas sobre dolor dental, ortodoncia, revisiones, radiografías, tratamientos básicos o primera consulta. |
| **Services** | Primera consulta dental, ortodoncia, revisión dental, radiografías, atención por dolor dental, limpieza, orientación inicial al paciente. |

### Verificación

- [ ] Pulsar guardar en el perfil.
- [ ] Recargar la página.
- [ ] Comprobar que el perfil aparece con los datos anteriores.
- [ ] No crear varios perfiles innecesarios antes de la demo (un perfil coherente basta).

---

## Step 2 — Contacts

**Pantalla:** http://localhost:3000/contacts

Crear manualmente estos tres contactos ficticios:

### Contacto 1

| Campo | Valor |
|-------|--------|
| **Name** | Laura Pérez |
| **Phone** | +34611111111 |
| **Source** | Instagram |
| **Status** | new |
| **Contact type** | lead |
| **Interest** | Primera consulta por dolor dental |
| **Notes** | Preguntó por disponibilidad esta semana. |

### Contacto 2

| Campo | Valor |
|-------|--------|
| **Name** | Carlos Gómez |
| **Email** | carlos.demo@example.com |
| **Source** | Web |
| **Status** | interested |
| **Contact type** | lead |
| **Interest** | Ortodoncia invisible |
| **Notes** | Quiere información sobre precios orientativos. |

### Contacto 3

| Campo | Valor |
|-------|--------|
| **Name** | Ana Rodríguez |
| **Phone** | +34622222222 |
| **Source** | Recomendación |
| **Status** | contacted |
| **Contact type** | patient |
| **Interest** | Revisión dental anual |
| **Notes** | Pendiente confirmar horario. |

### Verificación

- [ ] Los tres contactos aparecen en la lista.
- [ ] Los datos son claramente ficticios (teléfonos de ejemplo, email `@example.com`).
- [ ] No hay información clínica sensible en notas ni intereses.
- [ ] No hay datos reales de personas o empresas.

---

## Step 3 — Follow-Up Tasks

**Pantalla:** http://localhost:3000/follow-up-tasks

Crear manualmente estas tres tareas ficticias:

### Tarea 1

| Campo | Valor |
|-------|--------|
| **Title** | Llamar a Laura Pérez |
| **Description** | Confirmar si desea cita por dolor dental. |
| **Contact** | Laura Pérez |
| **Status** | open |
| **Priority** | high |
| **Source** | manual |

### Tarea 2

| Campo | Valor |
|-------|--------|
| **Title** | Preparar respuesta para Carlos Gómez |
| **Description** | Enviar información inicial sobre ortodoncia invisible y proponer valoración. |
| **Contact** | Carlos Gómez |
| **Status** | open |
| **Priority** | normal |
| **Source** | manual |

### Tarea 3

| Campo | Valor |
|-------|--------|
| **Title** | Confirmar horario con Ana Rodríguez |
| **Description** | Revisar disponibilidad y confirmar cita de revisión. |
| **Contact** | Ana Rodríguez |
| **Status** | open |
| **Priority** | normal |
| **Source** | manual |

### Verificación

- [ ] Las tres tareas aparecen en la lista.
- [ ] Cada tarea está asociada al contacto correcto (si la UI ofrece selector de contacto).
- [ ] No hay datos clínicos sensibles en títulos ni descripciones.
- [ ] No hace falta usar fechas reales de citas; prioriza datos de demo simples.

---

## Step 4 — Chat Demo Prompts

**Pantalla:** http://localhost:3000/chat

Probar estos prompts **antes** de la llamada comercial. El asistente debe usar el contexto del Business Profile guardado en el Step 1.

### Prompt 1

```
Según el perfil del negocio, dime qué tipo de asistente eres y cómo puedes ayudar a esta clínica.
```

### Prompt 2

```
Redacta una respuesta breve y cercana para un paciente que pregunta por dolor dental y disponibilidad esta semana.
```

### Prompt 3

```
Prepara un mensaje profesional para una persona interesada en ortodoncia invisible, sin dar precios cerrados y recomendando valoración.
```

### Prompt 4

```
Dame una lista de preguntas frecuentes que esta clínica podría responder automáticamente en el futuro.
```

### Prompt 5

```
Propón un flujo sencillo de seguimiento para nuevos pacientes interesados, manteniendo control humano.
```

### Verificación

- [ ] El asistente responde adaptado a una clínica dental (tono y contenido coherentes con el perfil).
- [ ] **No** afirma tener WhatsApp activo.
- [ ] **No** afirma tener agenda o calendario real activo.
- [ ] **No** afirma poder enviar emails reales.
- [ ] **No** inventa integraciones activas que no existen en el producto.
- [ ] Mantiene tono profesional, claro y cercano.

---

## Step 5 — Demo Flow Readiness

Checklist final antes de la llamada:

- [ ] `/business-profile` carga correctamente.
- [ ] `/chat` carga correctamente.
- [ ] `/contacts` carga correctamente.
- [ ] `/follow-up-tasks` carga correctamente.
- [ ] La navegación entre módulos funciona.
- [ ] El perfil de negocio está guardado.
- [ ] Los contactos ficticios están creados.
- [ ] Las tareas ficticias están creadas.
- [ ] Claude responde usando el contexto del negocio.
- [ ] No se muestran claves ni archivos `.env`.
- [ ] No se muestra Supabase.
- [ ] No se muestra código ni el IDE.
- [ ] No se muestran logs técnicos al cliente.
- [ ] No se usan datos reales en ningún módulo.

---

## What To Say During Demo

Frases breves sugeridas para la presentación:

### 1. El problema

> "Muchos pequeños negocios pierden tiempo respondiendo las mismas preguntas, organizando contactos y recordando seguimientos."

### 2. La solución

> "Esta demo muestra cómo un asistente con IA puede entender el negocio, ayudar a responder mejor y organizar contactos y tareas."

### 3. Honestidad

> "Lo que estás viendo ahora es una demo funcional. Algunas integraciones como WhatsApp, calendario o email pueden añadirse después, pero no las estoy presentando como activas en este momento."

### 4. Control humano

> "La idea no es que la IA tome decisiones sola, sino que ayude al equipo a trabajar mejor y con más orden."

---

## What Not To Say During Demo

Evita estas frases o promesas:

- "Esto ya está conectado a WhatsApp."
- "Esto agenda citas automáticamente."
- "Esto envía emails solo."
- "Esto reemplaza a tu equipo."
- "Esto ya es un CRM completo."
- "Esto ya cumple todo a nivel legal para datos clínicos."
- "Puedes meter aquí historias clínicas."
- "La IA toma decisiones por ti."

---

## Reset / Cleanup Notes

- Si creas datos de prueba de más durante la preparación, puedes dejarlos si son **claramente ficticios** y no contienen información sensible.
- **No** borres filas manualmente desde Supabase durante la demo.
- **No** abras Supabase delante del cliente.
- Más adelante se puede añadir una pantalla de limpieza o seeds controlados; **no** forma parte de este bloque ni de este checklist.

---

## Recommended Next Step

Después de completar este checklist, el siguiente bloque recomendado es:

### Final MVP Review

**Objetivo:** dejar el producto listo para decidir si se sube a un repositorio privado en GitHub.

Incluirá verificar:

- Rutas principales y navegación.
- Claude y contexto del Business Profile.
- Business Profile, Contacts y Follow-up Tasks.
- Lint y TypeScript.
- Git con working tree limpio.
- Ausencia de secretos expuestos en código o documentación.
