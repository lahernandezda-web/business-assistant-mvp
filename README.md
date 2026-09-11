# CURSOR / AI Building System
# Business Assistant MVP

Base reutilizable para crear prototipos y aplicaciones orientadas a negocios con inteligencia artificial, Supabase y módulos de gestión.

Este proyecto no fue creado como un producto final, sino como un punto de partida personal para desarrollar nuevas ideas sin tener que reconstruir desde cero funcionalidades comunes.

## ¿Qué incluye?

La base incorpora actualmente:

- Asistente conversacional con IA
- Persistencia del historial de conversaciones
- Generación automática de títulos
- Resúmenes para mantener el contexto de conversaciones largas
- Perfil configurable del negocio
- Uso de la información del negocio como contexto para el asistente
- Gestión básica de contactos
- Gestión de tareas de seguimiento
- Asociación entre contactos y tareas
- Persistencia de datos mediante Supabase

## Cómo lo utilizo

Cuando quiero desarrollar un nuevo prototipo, puedo partir de esta base y adaptar únicamente las partes necesarias:

- Interfaz
- Modelo de datos
- Prompts
- Funcionalidades
- Integraciones
- Automatizaciones

Esto me permite dedicar más tiempo al problema concreto que quiero resolver y reutilizar componentes que ya he probado anteriormente.

## Tecnologías utilizadas

- Next.js
- React
- TypeScript
- Supabase
- PostgreSQL / SQL
- Anthropic Claude API
- Git / GitHub

> Estas son las tecnologías utilizadas dentro del proyecto. No representan necesariamente el mismo nivel de dominio personal en todas ellas.

## Desarrollo asistido por IA

El proyecto fue desarrollado utilizando principalmente Cursor y herramientas de inteligencia artificial como apoyo al desarrollo.

Mi trabajo se ha centrado especialmente en:

- Definir la estructura y las funcionalidades de la base
- Diseñar los flujos de funcionamiento
- Trabajar con Supabase y SQL
- Configurar y probar funcionalidades
- Detectar errores e iterar sobre las soluciones
- Modificar y adaptar código generado con ayuda de IA
- Comprender progresivamente la arquitectura y la lógica del proyecto

No fue programado completamente línea por línea de forma manual.

El objetivo del proyecto forma parte de mi aprendizaje sobre cómo utilizar herramientas de IA para construir software, resolver problemas y desarrollar prototipos de forma más eficiente.

## Capturas

<!-- Añadir aquí capturas de la aplicación -->

## Estado actual

Este repositorio funciona como una base personal de desarrollo y aprendizaje.

No está pensado actualmente como una aplicación preparada para producción.

Algunas funcionalidades, como contactos y tareas, todavía funcionan de forma independiente del asistente y pueden modificarse o eliminarse dependiendo del proyecto que se construya a partir de esta base.

## Próximos pasos

- Mejorar la modularidad de los componentes
- Facilitar la reutilización de la base en nuevos proyectos
- Integrar nuevos tipos de automatización
- Mejorar la documentación
- Continuar profundizando en programación, SQL y arquitectura de aplicaciones

  
El código de la aplicación web está en `web/`. Para ejecutarla en desarrollo: `cd web`, luego `npm run dev` y abre `http://localhost:3000`.
