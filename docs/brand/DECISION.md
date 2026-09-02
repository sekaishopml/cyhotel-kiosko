# Decisión de Marca — Hotel del Valle

> Fecha: 2026-09-02 · Estado: **DECIDIDO** · Reemplaza la contradicción entre `02_identidad_visual.md` y `03_brand_kit.md`. Debe leerse junto a `01_estrategia_marca.md`.

## 1. Problema

- `02_identidad_visual.md` define paleta **verde profundo + papel cálido + bronce #B08D57** (concepto editorial boutique).
- `03_brand_kit.md` (APROBADO 2026-08-15) impone **solo blanco + verde** y prohíbe explícitamente dorado/bronce/vino/gradientes.
- En producción el **kiosco** usa `navy #0F172A + gold #D4AF37 + cream #FBF7F0` (lujo nocturno), mientras **admin/master** usan `verde #123526` (operativo). Resultado: el huésped ve 3 hoteles distintos.

## 2. Decisión

**Se adopta `03_brand_kit.md` como ley, con enmienda comercial 70/20/10.**

| Capa | Token | Hex | Rol | Nota |
|---|---|---|---|---|
| 70% fondo | `--hc-blanco` | `#FFFFFF` | Fondo primario kiosco (fuera de Idle), admin, master | En Idle nocturno se permite variante oscura `--hc-verde-900 #123526` como fondo (no navy) |
| 20% estructura | `--hc-verde-900` | `#123526` | Texto principal, header oscuro | Contraste AAA sobre blanco |
| 20% primario | `--hc-verde-800` | `#17452F` | Botones, enlaces activos, títulos | Hover `--hc-verde-700 #1E5638` |
| 20% líneas | `--hc-verde-15` | `rgba(17,53,38,.15)` | Bordes, divisores |  |
| 10% acento | `--hc-bronce-500` | `#B08D57` | **Solo precio ≥24px y badge premium**, nunca CTA primario | Enmienda a 03: bronce se reintroduce solo donde el negocio cobra (precio) |

**Qué se prohíbe a partir de esta fecha:**
- `navy #0F172A`, `gold #D4AF37`, `cream #FBF7F0` fuera de compatibilidad temporal en kiosco (ver §5 migración).
- Gradientes multicolor, sombras frías `rgba(15,23,42)`, CTA dorado 3D.
- `Inter` como sans del kiosco (migrar a `Manrope`).

## 3. Justificación

1.  **03 es el único documento APROBADO por Dirección** (2026-08-15) — prevalece sobre 02 (propuesta creativa).
2.  **Blanco+verde es más lujoso y legible en Guayaquil** que navy+gold: 13:1 vs 7:1, funciona bajo sol/calor húmedo sin deslumbrar, evoca follaje vs calor (narrativa 02).
3.  **Bronce como 10% comercial** resuelve la tensión: 03 prohíbe gold para "simplicidad editorial", pero el kiosco necesita jerarquía de precio. Limitar bronce a precio grande mantiene la ley y da señal de pago sin contaminar CTA.
4.  **Unificación operativa:** admin/master ya cumplen 03; alinear kiosco reduce mantenimiento 3×.

## 4. Tipografía (única)

- **Serif títulos:** `Cormorant Garamond 500/600/700 + itálicas` (`font-display: swap`, woff2 local para kiosco offline).
- **Sans cuerpo/controles:** `Manrope 400/700/800`.
- **Kickers:** Manrope 700 10–11px tracking 0.4em en `verde-800`.
- **Precios:** Cormorant 700 en `verde-800` (o `bronce-500` si ≥24px y sobre blanco).

## 5. Migración

| Fase | Kiosco | Admin/Master |
|---|---|---|
| **0 (hoy)** | Idle sigue navy+gold (ya publicado v1.2.7), resto `cream/navy` | Ya verde-blanco (ok) |
| **1 (Fase 1 fundación)** | Introducir `web/tokens.css` con `--hc-*`; mapear `navy→verde-900`, `gold→verde-800`/`bronce-500`, `cream→blanco/papel`. Header y StepBar a verde; CTA a verde-800 | Importar `tokens.css` (sin cambio visual) |
| **2 (Fase 4)** | Idle nocturno: fondo `verde-900 #123526` (no `#0a1626`), texto blanco, precio `bronce-500` solo si se mantiene dorado nocturno; de día fondo `blanco` | Sin cambio |
| **3** | Eliminar `02_identidad_visual.md` como fuente; mantener como **archivo histórico** con nota "reemplazado por DECISION 2026-09-02" | — |

## 6. Logotipo y Voz

- Wordmark apilado `HOTEL (Cormorant 500 0.5em) / DEL VALLE (600 0.2em)` en `verde-900` sobre blanco; variante blanco sobre `verde-900` para Idle oscuro. Monograma `HV` entrelazado para favicon/APK.
- Tagline oficial: **"Descanso elegante, trato de casa."** (01). El actual `"Tu descanso, tu espacio"` queda deprecado (fallback en `DEFAULT_CONFIG`).
- Tono: `de usted`, cálido sin servilismo (ver `01_estrategia_marca.md` §3).

## 7. Referencias

- `01_estrategia_marca.md` — posicionamiento Anfitrión/Refugio
- `02_identidad_visual.md` — histórico, reemplazado
- `03_brand_kit.md` — base aprobada
- `docs/ARCHITECTURE.md` §2 paletas
