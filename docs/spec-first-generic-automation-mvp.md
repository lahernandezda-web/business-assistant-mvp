# Spec — First Generic Automation MVP (`conversation.created` → n8n)

**Tipo:** especificación de diseño (solo documentación).  
**Proyecto:** CURSOR / AI Building System.  
**Relación:** se apoya en `docs/spec-automation-integration-mvp.md` (base n8n, header `X-Automation-Secret`, cliente server-side) y en `docs/spec-automation-conversation-created-mvp.md` (cuándo se emite el evento, payload mínimo, política best-effort). **No** define cambios de código en `web/` ni en rutas API; describe el **primer flujo genérico en n8n** que consume el evento ya integrado.

---

## 1. Objetivo

Definir el **primer flujo automatizado genérico y reutilizable** sobre la base ya construida: cuando la app emite **`conversation.created`**, n8n recibe el webhook, **valida el secret**, ejecuta una **acción externa mínima** (sin lógica de negocio vertical) y devuelve una **respuesta JSON acordada** con **HTTP 2xx** en el caso autorizado.

Este documento sirve para:

- Validar de extremo a extremo que **n8n recibe eventos reales** de la app tras crear un hilo nuevo.
- Congelar un **contrato de respuesta** simple entre el workflow y quien verifica (tests manuales, logs de la app vía `automation_update`, inspección en n8n).
- Mantener el alcance **deliberadamente pequeño** para no mezclar CRM, leads ni canales antes de tiempo.

---

## 2. Qué NO es

Queda explícito que este flujo **no** es:

- Una **automatización de negocio concreta** (clínica, residencia, retail, etc.).
- Un **CRM real**, pipeline de ventas ni scoring de leads.
- Un **sistema de leads** completo ni captura de formularios.
- **WhatsApp**, voz ni mensajería omnicanal.
- **Business Assistant** ni reglas de producto por tenant.
- Lógica **médica, dental, residencial** o cualquier dominio regulado.
- Un **sustituto del motor conversacional** (Claude, contexto, persistencia y respuesta al usuario siguen en la app).
- Un requisito para que el **chat responda**: la automatización es **auxiliar** y **no bloqueante** respecto al éxito del turno (ver specs base).

---

## 3. Evento disparador: `conversation.created`

| Aspecto | Descripción |
|--------|-------------|
| **Nombre** | `conversation.created` |
| **Estado en la app** | **Ya implementado** — emisión desde `POST /api/chat/turn` cuando corresponde (ver `docs/spec-automation-conversation-created-mvp.md`). |
| **Cuándo se emite** | Solo en el camino **“nueva conversación”**: no hay `conversation_id` reutilizable válido, el servidor **crea** una fila nueva en `conversations` y, **tras persistir con éxito el primer mensaje user** de ese turno, se dispara el envío a n8n. |
| **Frecuencia** | **Una vez por hilo nuevo** que cumpla la condición anterior; **no** se reemite en mensajes posteriores del mismo `conversation_id`. |
| **Qué no hace** | No se emite en lecturas (`GET` history/conversations), ni al reutilizar conversación existente, ni si falla la persistencia mínima acordada en la spec de evento. |

La verificación de este MVP asume que **`test.automation`** ya validó conectividad y secret (ver spec base); aquí el foco es el **primer evento de dominio “conversación”** con payload mínimo.

---

## 4. Payload esperado (cuerpo JSON hacia n8n)

Aproximación del cuerpo POST (mismo envelope que `createAutomationEvent` / `sendAutomationEvent`):

```json
{
  "event": "conversation.created",
  "occurred_at": "2026-05-14T12:00:01.000Z",
  "source": "cursor-ai-building-system",
  "data": {
    "conversation_id": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-05-14T12:00:00.500Z",
    "title": null,
    "origin": "chat"
  }
}
```

**Aclaraciones:**

- **No** incluye mensajes, historial, texto del user/assistant, **summary**, ni claves/tokens.
- **`title`** puede ser `null` en este punto del ciclo de vida (títulos siguen gobernados por su propio MVP; no se pide cambiar títulos desde este documento).
- Los valores exactos de timestamps son los que genere el servidor; en n8n deben tratarse como **strings ISO 8601**.

---

## 5. Workflow n8n propuesto (nodos sugeridos)

Orden lógico recomendado:

1. **Webhook** (POST) — URL configurada como `N8N_WEBHOOK_URL` en la app (mismo endpoint que ya consume `test.automation` y `conversation.created`, o path dedicado si en n8n se bifurca por campo `event`; lo importante es que la app apunte al destino acordado).
2. **IF / Switch / Function** — Rama **“secret válido”** vs **“no autorizado”** comparando el header `X-Automation-Secret` con el valor configurado en n8n (ver §6).
3. **Rama autorizada — acción mínima** (una de las opciones del §8; ejemplos):
   - **Opción A:** nodo **Respond to Webhook** con cuerpo JSON del §7 y HTTP 200.
   - **Opción B:** nodo **Google Sheets → Append Row** con columnas acordadas (ver §11), luego **Respond to Webhook** con el JSON del §7 y HTTP 200.
   - **Opción C:** nodo de **notificación interna** (Email / Telegram / Slack, si ya hay credenciales), luego **Respond to Webhook** con el JSON del §7 y HTTP 200.
4. **Rama no autorizada** — **Respond to Webhook** con cuerpo JSON del §7 (error) y código HTTP **401** o **403** (recomendado para distinguir de errores de app).

**Nota operativa:** el workflow debe estar **activo** en n8n; un workflow inactivo equivale a “no hay destino” desde la perspectiva de la app.

**Implementación verificada (Opción B):** en pruebas locales el flujo efectivo fue **Webhook** → **Check Secret** → **Flatten Data** → **Save to Google Sheets** → **Respond Success**; rama no autorizada: **Check Secret** → **Respond Unauthorized**.

---

## 6. Validación de secret

| Elemento | Requisito |
|----------|-----------|
| **Header** | `X-Automation-Secret` enviado por la app (valor de `N8N_WEBHOOK_SECRET` en el servidor; **nunca** en cliente ni en el repo). |
| **En n8n** | Comparar el header recibido con un **valor fijo** guardado en n8n (Credential, env del nodo, o variable de workflow según práctica del equipo). |
| **Si no coincide** | Responder en la rama no autorizada (§7) sin registrar la fila ni enviar notificaciones. |

**No documentar** aquí el secret real, URL completa del webhook de producción ni credenciales de Google u otros canales.

---

## 7. Respuesta esperada (cuerpo JSON desde n8n)

Contrato sugerido para que las pruebas manuales y la inspección de ejecución sean homogéneas (el cuerpo puede devolverse vía **Respond to Webhook**).

**Si el secret es correcto y el evento se acepta (antes o después de la acción mínima):**

- **HTTP:** `200` (recomendado).
- **Cuerpo:**

```json
{
  "ok": true,
  "received": true,
  "event": "conversation.created"
}
```

**Si no autorizado (header ausente o secret inválido):**

- **HTTP:** `401` o `403` (recomendado).
- **Cuerpo:**

```json
{
  "ok": false,
  "error": "unauthorized"
}
```

**Relación con la app:** en condiciones normales, la app interpreta **2xx** como envío exitoso hacia el webhook para efectos de `sent` en `automation_update` (ver `docs/spec-automation-conversation-created-mvp.md`). Un **401/403** debe contarse como **no enviado** / fallo de destino, **sin** romper el chat.

---

## 8. Opción recomendada para MVP

### Opciones mínimas posibles

| Opción | Descripción | Pros | Contras |
|--------|-------------|------|---------|
| **A — Solo OK** | Validar secret → `200` + JSON §7 | Máxima simplicidad, mínima superficie de fallo, ideal para smoke test | No deja rastro externo persistente |
| **B — Google Sheet** | Validar secret → Append fila (`occurred_at`, `event`, `conversation_id`, `origin`, `title`, `source` desde envelope) → `200` + JSON §7 | Primer **log externo** útil, reutilizable en futuros verticales, bajo contenido sensible si se respetan columnas | Requiere OAuth/credenciales Google y mantenimiento de la hoja |
| **C — Notificación interna** | Validar secret → email/Telegram/Slack → `200` + JSON §7 | Alerta en tiempo real | Más ruido operativo; depende de canales y permisos |

### Recomendación de este documento

**Opción B — Google Sheet** como **objetivo del primer flujo genérico** en n8n, alineado con la preferencia inicial del equipo: una vez validado `test.automation` y el evento real, registrar **metadatos** en una hoja es una acción externa **simple**, **auditable** y **reutilizable** (cualquier negocio futuro puede reutilizar el mismo patrón de “log de eventos” sin acoplarse a un CRM).

**Paso intermedio prudente (misma fase, minutos de trabajo):** si las credenciales de Google **no** están listas, ejecutar primero **Opción A** en el mismo workflow (o un duplicado de staging) para confirmar secret + JSON de respuesta; en cuanto Google esté disponible, añadir **Append Row** en la rama autorizada **sin** cambiar el contrato §7.

**Por qué no quedarse solo en A para siempre en esta fase:** el objetivo explícito del bloque es demostrar **acción externa** más allá del eco HTTP; A ya está conceptualmente cubierto por `test.automation`. B materializa ese siguiente peldaño **sin** introducir lógica de negocio en la app.

---

## 9. Fuera de alcance

No forma parte de este MVP:

- Evento **`message.created`** u otros eventos de mensaje.
- **Clasificación de leads**, scoring, enriquecimiento de datos.
- **CRM** productivo, pipelines, tareas asignadas.
- **Emails reales** si no hay canal configurado (Opción C opcional, no obligatoria).
- **WhatsApp** y canales externos al usuario final.
- **Business Assistant** multi-regla.
- **Auth multi-tenant** entre organizaciones.
- **Retries** avanzados, colas, DLQ, idempotencia distribuida.
- **RAG / embeddings** y volcado de contexto al webhook.
- Cualquier **lógica de negocio concreta** (vertical o regulada).
- Modificar **títulos, summaries, prompts o Claude** desde este flujo.

---

## 10. Criterios de éxito

El MVP de este documento se considera **cumplido** cuando:

1. n8n **recibe** un POST con `event: "conversation.created"` tras un turno que crea hilo nuevo.
2. n8n **valida** `X-Automation-Secret` correctamente.
3. n8n ejecuta la **acción mínima** elegida (A, B o C) en la rama autorizada.
4. n8n devuelve **HTTP 200** con el cuerpo **autorizado** del §7 en el caso feliz.
5. La app registra **`sent: true`** (vía `automation_update` / comportamiento documentado en la spec de evento) **sin** que falle el chat.
6. **No** se exponen secrets en logs del workflow, respuestas públicas ni documentación del repo.
7. **No** se envían mensajes, historial ni summary en el payload hacia n8n (solo lo acordado en §4).

---

## 11. Plan de implementación / prueba (bloques)

| Bloque | Contenido |
|--------|-----------|
| **1 — Spec** | Este documento (`docs/spec-first-generic-automation-mvp.md`) revisado y aceptado como referencia del primer flujo genérico en n8n. |
| **2 — Crear o ajustar workflow n8n** | Webhook + validación de secret + respuesta §7; activar workflow; usar URL de **staging** separada de producción si aplica. |
| **3 — Probar `conversation.created` desde `POST /api/chat/turn`** | Turno **sin** `conversation_id` válido → debe disparar el evento una vez; turno **con** `conversation_id` existente → no debe dispararlo. Comprobar `automation_update` y ejecución en n8n. |
| **4 — Si se elige Google Sheet** | Crear hoja con columnas: `occurred_at`, `event`, `conversation_id`, `origin`, `title`, `source` (última desde el envelope `source`); conectar credenciales; nodo **Append Row** / **Save to Google Sheets** mapeando desde el JSON del webhook tras **Flatten Data** (no desde campos no enviados). |
| **5 — Documentar resultado** | Anotar en el sistema de trabajo del equipo (ticket/nota interna) fecha, entorno y resultado **sin** pegar secrets ni URL productivas en el repo si la política lo prohíbe. |

---

## 12. Riesgos

| Riesgo | Notas / mitigación |
|--------|---------------------|
| **Duplicados en la hoja** | Re-ejecuciones manuales o reintentos futuros podrían duplicar filas; en MVP no hay idempotencia en n8n — aceptable si el volumen es bajo; en el futuro se puede añadir deduplicación por `conversation_id` + `occurred_at`. |
| **URL test vs production** | Mezclar variables en `.env.local` o en n8n puede enviar tráfico de desarrollo a un workflow productivo; usar URLs y secrets distintos por entorno. |
| **Workflow no activo** | Sintoma: fallos o timeouts desde la app; verificar toggle “Active” en n8n. |
| **Secret mal configurado** | Header distinto entre app y n8n → 401/403 y `sent: false`; corregir en ambos lados sin commitear valores. |
| **Enviar datos de más** | Riesgo de privacidad; ceñirse a columnas §8B y al payload §4; no añadir campos improvisados en el workflow que pidan datos que la app no envía (y no ampliar el payload desde la app sin nueva spec). |
| **Mezclar lógica de negocio antes de tiempo** | Mantener el flujo como **log o notificación neutra**; no ramificar por industria en este MVP. |
| **Depender de n8n para que el chat responda** | **Anti-patrón** — el usuario debe seguir recibiendo respuesta aunque n8n falle; no añadir dependencias síncronas desde n8n hacia la app en este diseño. |

---

## Implementation Status

- **Spec:** creada y mantenida en este documento (`docs/spec-first-generic-automation-mvp.md`).
- **Workflow n8n:** configurado y activo para pruebas; rama autorizada **Webhook → Check Secret → Flatten Data → Save to Google Sheets → Respond Success**; rama no autorizada **Check Secret → Respond Unauthorized**.
- **Google Sheet:** creada como log externo genérico — documento **CURSOR Automation Log**, pestaña **events**.
- **Columnas en Sheet:** `occurred_at`, `event`, `conversation_id`, `origin`, `title`, `source` (el campo `source` del envelope se mapea en n8n tras aplanar/normalizar el JSON; **no** implica enviar mensajes ni historial desde la app).
- **Flatten Data:** usado en el workflow para preparar filas coherentes antes de **Append Row** / **Save to Google Sheets**.
- **Save to Google Sheets:** verificado — se inserta una fila por evento `conversation.created` en condiciones de prueba locales.
- **Prueba end-to-end:** `POST /api/chat/turn` sin `conversation_id` → la app devolvió `automation_update.conversation_created.attempted = true` y `sent = true` → fila visible en Sheets con `event = conversation.created`, UUID real de conversación, `origin = chat`, `source = cursor-ai-building-system`, `title` vacío o null, `occurred_at` en ISO.
- **Seguridad en documentación:** no se versionan URL real del webhook, `N8N_WEBHOOK_SECRET` ni UUID completos de ejemplo de producción en este repo.

---

## Referencias cruzadas

- `docs/spec-automation-integration-mvp.md` — base, variables de entorno, header, política de errores.
- `docs/spec-automation-conversation-created-mvp.md` — disparador, payload, orden del turno, `automation_update`.

---

*Documento de diseño. No sustituye la configuración real en n8n ni valores de entorno; no incluye secretos.*
