---
title: Flujo de trabajo de OpenCode
status: accepted
date: 2026-09-03
---

# ADR-006: Flujo de trabajo de OpenCode

## Contexto

CyHotel combina kiosco offline, Android, backend multi-tenant y operación 24/7. La conversación de una sesión no es una memoria técnica permanente.

## Decisión

El trabajo asistido por IA sigue `Plan -> Build -> Review`:

1. Plan: analizar arquitectura, contratos, riesgos, módulos afectados y pruebas sin editar.
2. Build: aplicar el plan aprobado con el cambio mínimo, pruebas y documentación.
3. Review: revisar el diff como ingeniero senior, priorizando bugs, seguridad, concurrencia, regresiones y pruebas faltantes.

`AGENTS.md`, ADRs, OpenAPI, pruebas y Git son la memoria permanente. Las skills viven en `.opencode/skills/` y se cargan según el área afectada.

## Enrutamiento

Luna es el modelo principal configurado en el proyecto. Un modelo de razonamiento/revisión más costoso se reserva para arquitectura, seguridad y code review; modelos rápidos se reservan para documentación, tests sencillos y tareas repetitivas. Los IDs alternativos se fijan solo después de verificar que el proveedor los ofrece.

## Consecuencias

- Las tareas grandes requieren una fase explícita de revisión.
- El repositorio conserva decisiones y reglas aunque cambie el modelo o la conversación.
- No se añade una jerarquía de microservicios ni una migración de Android a Compose sin necesidad concreta.
