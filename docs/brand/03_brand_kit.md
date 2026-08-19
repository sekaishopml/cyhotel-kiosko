# Brand Kit Oficial — Hotel del Valle (aprobado por Dirección)

**Fecha:** 2026-08-15 · **Estado:** APROBADO — los agentes de diseño deben usar estos tokens exactos.

## Principio rector

**Solo dos colores: blanco y verde.** Fondo siempre blanco; letras y acentos
siempre en verde. Simplicidad editorial (referencia: Casa Angelina, pero en
verde). Ningún otro color, ningún degradado multicolor, ningún acento dorado
o vino.

## Tokens de color (obligatorios)

```css
:root {
  /* Blanco (fondo) */
  --hc-blanco:     #FFFFFF;

  /* Verde (letras, CTAs, líneas, acentos) */
  --hc-verde-900:  #123526;  /* títulos y texto principal */
  --hc-verde-800:  #17452F;  /* botones primarios */
  --hc-verde-700:  #1E5638;  /* hover de botones */
  --hc-verde-600:  #2E7D4F;  /* iconos, enlaces */
  --hc-verde-500:  #3E9A63;  /* detalles decorativos */

  /* Transparencias del mismo verde (nunca otro color) */
  --hc-verde-15:   rgba(23, 69, 47, .15);  /* bordes suaves */
  --hc-verde-08:   rgba(23, 69, 47, .08);  /* fondos de tarjetas */
  --hc-verde-05:   rgba(23, 69, 47, .05);  /* hovers suaves */
}
```

- Texto sobre fondo blanco: siempre `--hc-verde-900` (contraste AAA).
- Texto sobre botón verde: siempre blanco puro.
- Error: texto `--hc-verde-900` sobre fondo `--hc-verde-05` con borde izquierdo verde-800.
- Prohibido: vino, borgoña, champán, rojo, gris azulado, degradados de color.

## Tipografía

- Títulos: **Cormorant Garamond** (500/600/700), mayúsculas con tracking amplio (0.2–0.5em).
- Cuerpo y controles: **Manrope** (400/700/800).
- Kickers: Manrope 700, 10–11px, tracking 0.4em+, en verde-800.

## Componentes

- Radios: 4px (editorial, no redondeado).
- Bordes: 1px `--hc-verde-15` sobre blanco.
- Botón primario: fondo verde-800, texto blanco, tracking 0.24em, mayúsculas.
- Botón fantasma: borde 1px verde-15, texto verde-900.
- Tarjeta seleccionada: borde 2px verde-800 + anillo verde-05.
- Línea de firma: 1px degradada del mismo verde (transparente → verde-600 → transparente).
- Precios: Cormorant 700 en verde-800.

## Logotipo

Wordmark apilado en verde-900 sobre blanco: "HOTEL" (Cormorant 500, tracking 0.5em)
sobre "DEL VALLE" (Cormorant 600, tracking 0.2em). Sin colores adicionales.

## Motion

1. Transición de pantallas: fade+slide 12px, 400ms ease-out.
2. Loading: wordmark revelado letra por letra en verde, línea verde que se dibuja,
   barra de progreso verde — todo sobre fondo blanco.
3. Hover tarjetas: translateY(-3px) + borde verde.
Respetar `prefers-reduced-motion`.

## Tono de voz

Cálido, directo, de usted. "Descanso elegante, trato de casa." — siempre en verde.
