# Cómo usar esta base (plantilla / framework)

Este documento explica cómo debe usarse esta carpeta como **BASE reutilizable**, para no mezclar el **framework del sistema** con **productos o proyectos concretos** construidos encima.

---

## 1. Purpose

Esta base es un **framework reutilizable** para construir productos con IA conversacional, persistencia y automatizaciones **sin empezar desde cero**. Su función es concentrar capacidades genéricas (chat, memoria de conversación, integración con automatizaciones) que luego se reutilizan o se copian al iniciar un producto nuevo.

No sustituye la decisión de **dónde** vive el código del producto (repo separado, monorepo o plantilla congelada); solo deja claro que **mezclar producto y base en el mismo lugar sin estrategia** genera deuda y confusiones.

---

## 2. What This Base Includes

De forma resumida, la base actual incluye:

- **Chat** con Next.js App Router (aplicación en `web/`), UI en `/chat`.
- **Claude desde servidor** (llamadas desde el backend, no desde el cliente con claves).
- **Persistencia en Supabase**: conversaciones, mensajes, resúmenes asociados a conversación.
- **Historial recargable** y **lista de conversaciones** con previews coherentes con el contenido.
- **Títulos automáticos** de conversación y **resumen acumulado** para compactar contexto hacia el modelo.
- **Contexto compacto** hacia Claude (menos tokens, más control).
- **Búsqueda local** en el historial y **diagnósticos** pensados para no filtrar datos sensibles.
- **Base de automatizaciones (n8n)**: cliente server-side, endpoints de estado y prueba, integración del evento `conversation.created` en el flujo del chat, campo tipo `automation_update` en la respuesta cuando aplica.
- **First Generic Automation MVP** verificado en línea: App → n8n → registro genérico (por ejemplo Google Sheets como log externo de demostración).

---

## 3. What This Base Does Not Include Yet

La base **no** incluye (salvo que se añada explícitamente en el futuro como parte del framework):

- **Autenticación productiva** (login, sesiones, OAuth completo para usuarios finales).
- **Multi-tenant real** (aislamiento estricto por cliente/organización a nivel de producto).
- **RLS (Row Level Security) productivo** en Supabase alineado con usuarios y tenants.
- **Business Assistant** u otros asistentes verticales ya implementados como producto.
- **WhatsApp** u otros canales de mensajería externos integrados de forma productiva.
- **Voz** (agentes de voz, streaming de audio, proveedores de voz).
- **Evento `message.created` activo** como contrato estable de automatización (puede existir o no según versión; no debe asumirse como base estable sin revisar el código).
- **Automatizaciones de negocio concretas** (flujos n8n específicos de un cliente o vertical más allá del MVP genérico de referencia).
- **Panel de administración** completo para operar el producto.
- **Facturación / billing** integrado.
- **Despliegue productivo completo** (CI/CD, observabilidad, hardening, dominios, etc.) documentado como parte obligatoria de la plantilla.

---

## 4. How To Start A New Product

Antes de escribir código de producto, elige **una** estrategia consciente. Opciones recomendadas:

### Option A — Clone this repo as a new product repo

**Recomendada para productos independientes.** Clona o copia el repositorio base, renómbralo y evoluciona el producto ahí. La base original puede seguir como referencia o plantilla limpia.

### Option B — Create a separate `/products` or `/apps` structure

Solo si se decide **explícitamente** mantener un **monorepo** con convenciones claras (límites entre `base` y `producto`, dependencias y despliegues). Requiere disciplina para no contaminar la base con lógica vertical.

### Option C — Keep this repo frozen as the base template and copy it when needed

**Recomendada si se quiere proteger la base.** Este repo solo recibe mejoras del framework; cada producto nace de una **copia** o de un **nuevo repo** generado desde una etiqueta o snapshot acordado.

**No se recomienda** empezar un producto concreto directamente en la raíz actual (mezclando prompts de clínica, CRM, WhatsApp, etc.) **sin** haber decidido antes separación de repos, carpetas o política de merges.

---

## 5. Environment Setup For A New Product

Pasos seguros y habituales (sin valores reales en documentación ni en commits):

1. Copiar `web/.env.example` a `web/.env.local`.
2. Rellenar **manualmente** las variables con claves reales en tu máquina o en el entorno de despliegue; **nunca** subir `.env.local` al control de versiones.
3. Configurar la **API de Claude** según las variables documentadas en el ejemplo (nombres de variables, no valores).
4. Configurar **Supabase** (URL del proyecto y claves con permisos acotados donde sea posible).
5. Si el proyecto Supabase es nuevo, aplicar el esquema acordado (por ejemplo el `schema.sql` del repositorio, si existe en la versión que uses).
6. Si usarás automatizaciones, configurar la **URL del webhook de n8n** y credenciales auxiliares solo en entorno local o secretos del proveedor de despliegue.
7. Configurar **Google Sheets** u otro destino de log **solo** si quieres el mismo patrón de MVP genérico; es opcional para el producto.

No documentes en tickets, chats públicos ni en código: claves reales, URLs internas con tokens, secretos, UUIDs de datos privados ni ejemplos copiados de producción.

---

## 6. Recommended Development Method

Metodología sugerida:

**PLAN → SPEC → BUILD → VERIFY**

Reglas prácticas:

- Evitar solicitudes del tipo «haz toda la app»; partir en **bloques pequeños** entregables.
- Si aparece **arquitectura nueva** (auth, multi-tenant, nuevo contrato de eventos), **documentar** (spec breve) antes de implementar.
- **Verificar** endpoints y flujos críticos antes de apilar más funcionalidad.
- Mantener **control humano** sobre alcance, secretos y datos sensibles.
- **No** añadir dependencias sin necesidad clara.
- **No** hacer refactors grandes sin permiso explícito; preferir cambios acotados y reversibles.

---

## 7. Base vs Product Rule

**Regla:** la **BASE** solo debe contener **capacidades reutilizables**. Los **PRODUCTOS** deben contener **lógica específica de negocio** y configuración comercial.

| Base (reutilizable) | Producto (específico) |
|---------------------|------------------------|
| Conversación genérica, modelo de mensajes | Prompts y tono de «clínica dental» o asistente legal |
| Persistencia, listados, títulos, summaries | CRM, pipelines y entidades de un cliente |
| Cliente de automatización y eventos genéricos acordados | Flujos n8n verticales, integraciones con ERP propios |
| Diagnósticos seguros, políticas de coste/token | Reglas de negocio, SLAs, precios |
| Patrones de UI de chat reutilizables | Formularios, branding y copy de mercado |

Si un cambio solo tiene sentido para **un** cliente o **un** vertical, probablemente **no** pertenece a la base.

---

## 8. Before Starting A Product Checklist

Antes de implementar, revisar mentalmente:

- [ ] ¿Este cambio pertenece a la **base** o a un **producto**?
- [ ] ¿Necesito **clonar** el repo o separar carpeta/proyecto?
- [ ] ¿Necesito **auth** o modelo de **usuarios**?
- [ ] ¿Necesito **RLS** y políticas en Supabase alineadas con identidades?
- [ ] ¿Necesito **URL de n8n** de producción y secretos rotados?
- [ ] ¿Necesito **`message.created`** o basta con **`conversation.created`** para el MVP?
- [ ] ¿Estoy guardando **datos sensibles**? ¿Están minimizados y cifrados/acotados según normativa aplicable?
- [ ] ¿Estoy **evitando exponer claves** en cliente, logs y repositorio?
- [ ] ¿El producto debe **vivir separado** de esta plantilla a medio plazo?

---

## 9. Current Recommended Next Step

Cuando se dé por **cerrada la iteración actual de la base** (criterio humano del equipo, no una etiqueta automática del documento), el siguiente paso coherente es **decidir la arquitectura de separación** (Opción A, B o C, o variante documentada) **antes** de comenzar cualquier producto concreto (Business Assistant, clínica, WhatsApp, voz, SaaS vertical, etc.). Así se preserva la base como plantilla y se evita mezclar responsabilidades.
