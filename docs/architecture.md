# Arquitectura

## Visión general

Arquitectura **moderna, modular y práctica** para startups y automatizaciones reales:

- **Next.js** sirve UI y una **API interna ligera** (Route Handlers / capa servidor) que orquesta cada turno de conversación.
- **Supabase** almacena conversaciones, usuarios/tenants y configuración; **Row Level Security** acota el acceso por `tenant_id` / `user_id`.
- **Claude API** se invoca únicamente desde el servidor, con contexto mínimo necesario según la política de tokens del proyecto.

No se asumen microservicios, Docker ni Redis en el MVP base.

## Modularidad

La modularidad se basa en:

1. **Dominio primero** — lógica de agente, persistencia y políticas separadas de componentes de UI.
2. **Contrato de turno** — una función o módulo “run turn” recibe mensaje (y ids), devuelve respuesta y registra en BD; web, WhatsApp o voz reutilizan el mismo núcleo.
3. **Adaptadores de canal** — cada canal implementa: normalizar entrada → llamar al motor → enviar salida al proveedor externo.

Así se pueden añadir negocios o tenants con **configuración y prompts** sin duplicar el motor completo.

## Flujo de datos (un turno típico)

1. **Cliente** (web u otro canal) envía el mensaje del usuario y referencias (`conversation_id`, `tenant_id` según diseño).
2. **Servidor Next** valida sesión (JWT Supabase), aplica límites y carga contexto desde Postgres (**resumen + ventana reciente + hechos estructurados** cuando existan).
3. **Servidor** construye el payload para Claude: system estable + bloque corto de contexto volátil + historial acotado.
4. **Claude** responde con texto y/o **tool calls** si el producto las define.
5. Si hay tools: el **servidor** ejecuta herramientas con permisos controlados, devuelve resultados al modelo en el mismo turno hasta cerrar.
6. **Servidor** persiste mensajes y metadatos (tokens, modelo, latencia) en Supabase.
7. **Respuesta** al cliente (o al adaptador del canal).

Los secretos y la clave de Anthropic **nunca** pasan al navegador.

## Multi-negocio (reutilización)

- Entidad **tenant** (o `project`) y `tenant_id` en tablas de conversaciones y configuración.
- **RLS** en Supabase para que cada tenant solo vea sus datos.
- Prompts y límites por tenant en BD o archivos versionados referenciados por versión.

## Integración futura: WhatsApp Cloud API

- Meta envía **webhooks HTTP** a un endpoint dedicado del mismo Next (o función separada solo si escala el tráfico).
- El webhook **normaliza** el payload a un tipo interno (texto, ids de conversación en Meta, timestamps).
- Se reutiliza el mismo **motor de turno** que la web.
- La salida se envía con la **API de envío de mensajes** de Meta.

El núcleo no depende de Meta; solo el adaptador `channels/whatsapp`.

## Integración futura: n8n

- n8n cubre **orquestación**, CRM, alertas, tareas batch y “humano en el loop”, no el razonamiento principal del chat.
- Contrato simple: llamadas **firmadas** (p. ej. HMAC) entre n8n y un endpoint interno con `action` + `payload`, o webhooks que actualicen estado en Supabase.
- Evitar duplicar lógica de agente en n8n; n8n **dispara** o **actualiza datos**; Claude sigue siendo el cerebro conversacional en el servidor Next.

## Preparación: agentes de voz

- Mismo **contrato de mensaje** texto: audio → STT (proveedor futuro) → texto → motor → texto → TTS.
- **Latencia**: en voz conviene menos ida-vuelta de tools y prompts más cortos; la política de tokens puede ser más estricta por canal.
- Carpeta o módulo reservado para `channels/voice` sin implementar STT/TTS hasta la fase correspondiente.

## Qué se evita de forma explícita

- Microservicios innecesarios.
- Docker obligatorio en desarrollo.
- Redis solo por moda; introducirlo cuando colas, rate limits distribuidos o caché caliente lo justifiquen mediblemente.
- Dependencias y capas vacías “por si acaso”.

## Documentación relacionada

- `docs/project-brief.md` — objetivo y filosofía.
- `docs/token-cost-policy.md` — cómo acotar contexto y coste en Claude.
- `docs/roadmap.md` — orden de implementación.
