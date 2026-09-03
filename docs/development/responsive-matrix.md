# Matriz Responsive P1a — Kiosco

> Alcance: fundación responsive. Sin cambios de lógica, precios, seguridad, backend ni Android. Paleta vigente: `docs/brand/DECISION.md` (70/20/10 blanco+verde+bronce).

## 1. Viewports objetivo (CSS px)

| Caso | CSS | Orientación | Rol |
|---|---|---|---|
| 600×1024 | 600×1024 | portrait | Tablet vertical mínima |
| 800×1280 | 800×1280 | portrait | Tablet vertical grande |
| 1024×600 | 1024×600 | landscape | Tablet horizontal corta (caso crítico en alto) |
| 1280×800 | 1280×800 | landscape | Tablet horizontal amplia |

## 2. DPR

| DPR | Efecto | Regla |
|---|---|---|
| 1 | 1:1 CSS:físico | Base legible, sin ajustes |
| 1.5 | Escala intermedia Android | Usar unidades CSS/rem, nada en px físicos; imágenes con `srcset` si aplica |
| 2 | Retina | Ídem; no fijar tamaños en px físicos, respetar `clamp()` de `index.css` |

## 3. Reglas portrait / landscape

- Portrait (600×1024, 800×1280): 1 columna vertical. Plan: lista 1 col. Room: lista 1 col.
- Landscape (1024×600, 1280×800): 2 columnas. Plan: `tablet-landscape:grid-cols-2` (2×2). Room: `tablet-landscape:grid-cols-2`.
- Breakpoints (`tailwind.config.js`, solo añadidos, colores intactos):
  - `kiosk-sm: 600px`
  - `tablet-portrait: (min-width: 600px) and (orientation: portrait)`
  - `tablet-landscape: (min-width: 1024px) and (orientation: landscape)`
- Utilidades CSS (`index.css`): `.portrait-only` / `.landscape-only` con `@media (orientation: ...)`.
- 1024×600: prima altura. La grilla usa scroll interno, nunca comprime CTA ni header.

## 4. Safe-area

- `#root` / `body`: `min-height: 100svh` + `100dvh` (caída `100%`).
- `.kiosk-viewport`: `padding` con `env(safe-area-inset-top/right/bottom/left, 0px)`.
- `.kiosk-cta-safe`: `padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px))` para CTA sobre gesto inferior.
- No usar `100vh` fijo: en Android WebView recorta con barras del sistema.

## 5. Región de scroll única

- Una sola región con scroll por pantalla: `.kiosk-scroll` (`flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain`).
- Header, StepBar/progreso y CTA son `shrink-0` fijos fuera del scroll.
- `body`/`html`: `overflow: hidden` (sin scroll global, sin doble scroll).
- Plan: contenedor central `.kiosk-scroll`; Room: lista central `.kiosk-scroll`.

## 6. CTA visible

- CTA (`Continuar`, `idle-cta`) siempre fuera del scroll, `shrink-0`, con `.kiosk-cta-safe`.
- Verificación por viewport: título + 1er ítem + CTA visibles sin scrollear en 1280×800 y 800×1280; en 1024×600 y 600×1024 se acepta scroll de lista, CTA nunca tapado.
- Sin cambios de color/gradiente en esta fase (lo hace otro agente según `DECISION.md`).

## 7. Verificación

```bash
cd web/kiosco && npm run typecheck
```

- Manual: DevTools 600×1024, 800×1280, 1024×600, 1280×800 + DPR 1/1.5/2; rotar; confirmar 1 col portrait / 2 col landscape, un solo scroll, CTA visible.
