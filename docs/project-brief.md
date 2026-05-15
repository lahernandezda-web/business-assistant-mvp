# Project brief

## Objetivo general

Construir un **sistema modular** reutilizable para **chatbots**, **agentes de voz** y **automatizaciones**, orientado a **MVPs rápidos, baratos y fáciles de mantener** para distintos negocios sin reescribir el núcleo en cada proyecto.

El producto prioriza **simplicidad**, **coste bajo** y **escalado gradual** frente a arquitecturas enterprise o microservicios prematuros.

## Stack elegido

| Área | Tecnología |
|------|------------|
| Frontend y API interna (BFF) | **Next.js** (App Router) |
| Datos, auth y reglas de acceso | **Supabase** (Postgres + RLS) |
| Orquestación e integraciones (fase posterior) | **n8n** |
| Canal mensajería (fase posterior) | **WhatsApp Cloud API** |
| IA principal | **Claude API (Anthropic)** |

Canales futuros (p. ej. voz) se conectan como **adaptadores** al mismo motor de conversación, no como productos paralelos.

## Filosofía del proyecto

1. **Monolito modular por carpetas** — un solo despliegue lógico; la modularidad está en el código y en contratos claros, no en muchos servicios desde el día uno.
2. **Claude solo en servidor** — claves y llamadas a modelo nunca en el cliente.
3. **Supabase como fuente de verdad** — conversaciones, configuración por tenant y metadatos de uso viven en Postgres con RLS.
4. **Canales y automatización desacoplados** — WhatsApp y n8n son integraciones opcionales que hablan el mismo flujo interno (`entrada normalizada → motor → salida`).
5. **Evitar sobreingeniería** — sin Docker obligatorio, sin Redis obligatorio, sin microservicios hasta que el volumen o el equipo lo exijan.
6. **Coste y tokens conscientes** — prompts acotados, ventana de historial, resúmenes y políticas explícitas (ver `docs/token-cost-policy.md`).

## Documentación relacionada

- `docs/architecture.md` — diseño técnico y flujos.
- `docs/token-cost-policy.md` — reglas de uso eficiente de Claude API.
- `docs/roadmap.md` — fases del MVP.
