# Product Demo MVP Spec

## Purpose

Este documento define **cómo presentar** `business-assistant-mvp` como **demo comercial de Nivel 2** para pequeños negocios.

No describe implementación técnica ni código. Su objetivo es alinear discurso, datos ficticios, flujo de pantallas y reglas de honestidad para una **llamada de Zoom** (o reunión similar) donde se muestre que es posible construir un **asistente empresarial con IA** adaptado al negocio del cliente.

La demo debe transmitir valor comercial sin prometer integraciones o capacidades que **aún no existen** en el producto.

---

## Product Level

| Nivel | Qué es | Rol en la demo |
|-------|--------|----------------|
| **Nivel 1** | `CURSOR.p1` | Base congelada y reutilizable (chat, persistencia, patrones). **No** se presenta como producto al cliente. |
| **Nivel 2** | `business-assistant-mvp` | Producto demo **genérico** para negocios: perfil, chat contextual, contactos, tareas, navegación. **Es lo que se muestra en Zoom.** |
| **Nivel 3** (futuro) | Web propia, cliente piloto o implementación por empresa | Fuera de este repo por ahora. Se decide **después** de validar la demo de Nivel 2. |

**Regla:** no mezclar la web propia del usuario final ni un despliegue de cliente real dentro de `business-assistant-mvp` en esta fase. Este repositorio permanece como **plantilla demo genérica**.

---

## Demo Audience

Público objetivo de la demo (pequeños negocios con consultas repetitivas, leads y seguimiento manual):

- Clínicas dentales
- Centros estéticos
- Fisioterapeutas
- Academias y formación
- Consultorios y gabinetes
- Asesorías y servicios profesionales
- Negocios locales que reciben consultas por Instagram, web o teléfono y hacen seguimiento a mano

**Perfil del decisor:** dueño, gerente o responsable comercial/administrativo que quiere **ordenar información**, **responder mejor** y **no perder oportunidades**, sin necesitar un CRM enterprise.

---

## Demo Positioning

### Cómo presentar el producto

**No** venderlo como SaaS terminado, producto en producción ni plataforma con todas las integraciones activas.

**Sí** presentarlo como:

> Un asistente empresarial con IA adaptable a tu negocio, que puede ayudarte a organizar información, responder mejor, registrar contactos y mantener seguimiento, con posibilidad de crecer hacia automatizaciones e integraciones.

### Mensajes clave

- El asistente **usa el contexto del negocio** (perfil guardado) para alinear tono y servicios.
- Los **contactos** y las **tareas de seguimiento** son registros simples bajo **control humano**.
- Las **integraciones futuras** (WhatsApp, web, email, calendario, automatizaciones) son **roadmap**, no capacidades actuales.

### Qué evitar prometer

| No prometer | Motivo |
|-------------|--------|
| WhatsApp activo | No implementado en Nivel 2 |
| Agenda / calendario real conectado | No implementado |
| Email conectado (envío/recepción) | No implementado |
| CRM completo (pipeline, informes, equipos) | Fuera de alcance MVP |
| Automatizaciones reales (n8n, flujos autónomos) | Desactivado (`AUTOMATIONS_ENABLED=false`) |
| Deployment productivo / dominio del cliente | No documentado en Nivel 2 |
| Cumplimiento legal completo (RGPD sector salud, etc.) | Requiere análisis por proyecto Nivel 3 |

---

## Recommended Demo Business

**Negocio ficticio principal:** **Clínica dental en A Coruña**

**Motivos:**

- Fácil de entender para la audiencia.
- Combina pacientes, leads y consultas repetitivas.
- Permite mostrar contactos y tareas sin entrar en historia clínica.
- Permite hablar de servicios, tono y primeras consultas de forma comercial/administrativa.
- Alineado con datos de prueba ya usados en el producto (sin usar datos reales).

---

## Demo Data

Datos **ficticios** recomendados. Cargar manualmente en la UI antes de la demo o usar los que ya existan si coinciden. **No** usar pacientes reales ni datos clínicos sensibles.

### Business Profile sugerido

| Campo | Valor |
|-------|--------|
| **Name** | Clínica Dental Sonrisa Norte |
| **Industry** | Clínica dental |
| **Location** | A Coruña, España |
| **Tone** | Profesional, claro, cercano y tranquilizador |
| **Description** | Clínica dental enfocada en atención cercana, prevención, diagnóstico inicial y orientación del paciente antes de la consulta presencial. |
| **Target customer** | Personas que necesitan resolver dudas sobre dolor dental, ortodoncia, revisiones, radiografías, tratamientos básicos o primera consulta. |
| **Services** | Primera consulta dental, ortodoncia, revisión dental, radiografías, atención por dolor dental, limpieza, orientación inicial al paciente. |

### Contacts ficticios

**1. Laura Pérez**

| Campo | Valor |
|-------|--------|
| phone | +34611111111 |
| source | Instagram |
| status | new |
| contact_type | lead |
| interest | Primera consulta por dolor dental |
| notes | Preguntó por disponibilidad esta semana. |

**2. Carlos Gómez**

| Campo | Valor |
|-------|--------|
| email | carlos.demo@example.com |
| source | Web |
| status | interested |
| contact_type | lead |
| interest | Ortodoncia invisible |
| notes | Quiere información sobre precios orientativos. |

**3. Ana Rodríguez**

| Campo | Valor |
|-------|--------|
| phone | +34622222222 |
| source | Recomendación |
| status | contacted |
| contact_type | patient |
| interest | Revisión dental anual |
| notes | Pendiente confirmar horario. |

### Follow-up tasks ficticias

**1. Llamar a Laura Pérez**

| Campo | Valor |
|-------|--------|
| description | Confirmar si desea cita por dolor dental. |
| status | open |
| priority | high |
| source | manual |
| contact_id | (asociar a Laura Pérez si existe) |

**2. Preparar respuesta para Carlos Gómez**

| Campo | Valor |
|-------|--------|
| description | Enviar información inicial sobre ortodoncia invisible y proponer valoración. |
| status | open |
| priority | normal |
| source | manual |
| contact_id | (asociar a Carlos Gómez si existe) |

**3. Confirmar horario con Ana Rodríguez**

| Campo | Valor |
|-------|--------|
| description | Revisar disponibilidad y confirmar cita de revisión. |
| status | open |
| priority | normal |
| source | manual |
| contact_id | (asociar a Ana Rodríguez si existe) |

---

## Demo Flow

Flujo recomendado para una llamada de Zoom (~15–25 minutos según profundidad):

| Paso | Acción | Objetivo |
|------|--------|----------|
| 1 | Abrir `/business-profile` | Mostrar que el negocio tiene **perfil guardado** (contexto para la IA). |
| 2 | Revisar campos del perfil (Sonrisa Norte) | Reforzar servicios, tono y cliente objetivo. |
| 3 | Abrir `/chat` | Entrar al asistente. |
| 4 | Preguntar: *«Según el perfil del negocio, ¿cómo ayudarías a esta clínica dental?»* | Demostrar respuesta **alineada al perfil**. |
| 5 | Abrir `/contacts` | Mostrar **leads/contactos** ficticios. |
| 6 | (Opcional) Crear un contacto nuevo en vivo | Demostrar registro manual rápido. |
| 7 | Abrir `/follow-up-tasks` | Mostrar **tareas pendientes**. |
| 8 | (Opcional) Crear tarea en vivo asociada a un contacto | Demostrar seguimiento accionable. |
| 9 | Volver a `/chat` | Cerrar el ciclo asistente ↔ operación. |
| 10 | Preguntar: *«Ayúdame a redactar una respuesta profesional para un paciente interesado en ortodoncia invisible.»* | Demostrar **redacción** sin ejecutar envíos. |
| 11 | Cierre con **roadmap futuro** | WhatsApp, web widget, email, calendario, automatizaciones, voz — como **evolución**, no como hecho. |

Usar la **barra de navegación** (`ModuleNav`) entre pasos; no escribir URLs manualmente en la llamada.

---

## Suggested Chat Prompts for Demo

Prompts listos para copiar/pegar en `/chat`:

**1. Rol del asistente**

> Según el perfil del negocio, dime qué tipo de asistente eres y cómo puedes ayudar a esta clínica.

**2. Respuesta a dolor dental**

> Redacta una respuesta breve y cercana para un paciente que pregunta por dolor dental y disponibilidad esta semana.

**3. Ortodoncia invisible**

> Prepara un mensaje profesional para una persona interesada en ortodoncia invisible, sin dar precios cerrados y recomendando valoración.

**4. FAQ futura**

> Dame una lista de preguntas frecuentes que esta clínica podría responder automáticamente en el futuro.

**5. Flujo de seguimiento**

> Propón un flujo sencillo de seguimiento para nuevos pacientes interesados, manteniendo control humano.

---

## What To Show

En la demo **sí** mostrar:

- Navegación entre módulos (`/chat`, `/business-profile`, `/contacts`, `/follow-up-tasks`)
- Perfil del negocio guardado y su impacto en el chat
- Chat con IA contextualizada (Claude en local para la demo del presentador)
- Listado y creación de contactos (datos comerciales/administrativos)
- Listado y creación de tareas de seguimiento (opcionalmente ligadas a contacto)
- Mensaje de **control humano** (las acciones importantes las decide la persona)
- **Roadmap futuro** honesto (integraciones y automatizaciones como siguiente fase)

---

## What Not To Show Yet

En la demo **no** mostrar:

- Código, repositorio ni IDE
- Supabase, tablas SQL ni panel de base de datos
- `web/.env.local`, claves API ni variables de entorno
- Logs técnicos, consola de errores ni DevTools salvo emergencia
- n8n ni flujos de automatización
- Promesas de WhatsApp, agenda o email **ya activos**
- Automatizaciones no implementadas como si funcionaran
- Datos personales **reales** de clientes o pacientes
- Datos clínicos reales (diagnósticos, tratamientos, historiales)

---

## Demo Script Outline

Guion breve (~10 min de narración + demo en pantalla):

1. **Problema del negocio** — Consultas repetitivas, leads dispersos, seguimiento manual, respuestas inconsistentes.
2. **Qué hace esta demo** — Asistente con contexto del negocio + registro de contactos + tareas; no es CRM ni clínica digital.
3. **Configuración del negocio** — Pantalla Business Profile (Sonrisa Norte).
4. **Chat con IA contextual** — Pregunta alineada al perfil; tono y servicios coherentes.
5. **Contactos** — Leads ficticios; opcional alta en vivo.
6. **Tareas de seguimiento** — Pendientes visibles; control humano.
7. **Futuras integraciones** — WhatsApp, web, email, calendario, automatizaciones, voz: **planificables**, no activas hoy.
8. **Cierre comercial** — Nivel 2 como demo; Nivel 3 como adaptación a su marca, despliegue o piloto.

Mantener el discurso **corto y práctico**; profundizar solo si el prospecto pregunta.

---

## Safety and Honesty Rules

| Regla | Aplicación |
|-------|------------|
| Separar **implementado** vs **roadmap** | Decir explícitamente qué pantallas existen hoy y qué es evolución futura. |
| No prometer integraciones inactivas | WhatsApp, email, calendar, n8n: “se puede planificar / implementar después”. |
| Solo datos ficticios en demo | Laura Pérez, Carlos Gómez, etc. son ejemplos; no pacientes reales. |
| No datos clínicos sensibles | No diagnósticos, tratamientos ni historiales en perfil, contactos, tareas ni chat. |
| No presentar como sistema clínico | Es asistente **administrativo/comercial**; no sustituye historia clínica ni software sanitario. |
| Revisión humana | Crear tareas, contactar clientes y enviar mensajes requiere decisión de la persona. |
| Privacidad en conversación | No leer ni compartir `.env.local` ni claves en la llamada. |

---

## Future Levels

**Nivel 2** concluye como **demo genérica vendible** en Zoom: demuestra el concepto sin comprometer un cliente concreto en este repo.

**Nivel 3** (después de validar interés) podría ser, entre otras:

1. **Web propia del usuario** — Marca, dominio y copy del negocio real.
2. **Cliente piloto** — Un negocio concreto con datos y flujos acordados.
3. **Versión deployable** — Hosting, auth básica, entorno estable.
4. **Producto vertical** — Variante especializada (p. ej. clínicas dentales u otro sector).

La decisión de Nivel 3 es **comercial y de alcance**, no técnica dentro de este bloque.

---

## Recommended Next Step

**Bloque siguiente recomendado:** **Demo Seed Checklist**

Objetivo:

- Preparar **manualmente** los datos ficticios de esta SPEC en el entorno local antes de la llamada.
- Verificar que el recorrido **de principio a fin** funciona (perfil → chat → contactos → tareas → chat).
- **No** crear seeds automáticos ni scripts de inserción masiva todavía.
- **No** insertar datos reales de clientes o pacientes.
- Confirmar que Business Profile, contactos y tareas coinciden (o se actualizan) con los valores de **Demo Data**.

---

*Documento de especificación únicamente. Producto: business-assistant-mvp (Nivel 2). Base CURSOR.p1 (Nivel 1) no aplica a la narrativa comercial de la demo.*
