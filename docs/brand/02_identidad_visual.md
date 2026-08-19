# 02 — Identidad Visual

**Hotel del Valle** · Boutique premium · Guayaquil, Ecuador
Documento del director creativo · Aplica a: kiosco de check-in (tablet apaisada), dashboard admin (desktop) y piezas impresas.

---

## 1. Concepto creativo

**Nombre del concepto: "El descanso en el centro de Guayaquil"**

Dirección de arte editorial y sobria: el hotel como un cuaderno de notas de un viajero elegante, donde la ciudad queda afuera y entra la calma del centro. Nada de gradientes genéricos ni imágenes de stock corporativas: la interfaz respira como la recepción de un boutique hotel — madera, lino, verde de follaje, luz de tarde.

- **Fotografía:** luz cálida de atardecer filtrada por hojas grandes; sábanas blancas con arrugas reales; detalles de madera oscura y bronce; ventanas que asoman a un patio verde; detalles de la casa en contrapicado suave. Sin personas de pie, sin atuendos de hotel genérico.
- **Atmósfera emocional:** silencio, frescor frente al calor húmedo de la calle, sensación de "ya llegué a casa". Las palabras clave que guían cada decisión: *calma, cálido, cuidado, confiable*.
- **Regla de arte:** las superficies grandes son neutras cálidas; el verde profundo aparece como acento de autoridad (encabezados, estados, botones principales) y el bronce como firma de lujo discreto (precios, CTA premium, detalles de paso). La interfaz debe sentirse diseñada en una imprenta, no en una plantilla de SaaS.

---

## 2. Paleta de color

Nombres en español, usables como tokens `--hc-<nombre>`.

### Primario — Verde profundo

| Token | Hex | Uso |
|---|---|---|
| `verde-950` | `#13261D` | Fondos oscuros, footer, texto sobre bronce |
| `verde-900` | `#1A3227` | Header oscuro del kiosco, pantalla de bienvenida |
| `verde-800` | `#1F3A2D` | **Primario principal**: botones, enlaces activos, títulos de sección |
| `verde-700` | `#2C4E3D` | Hover de botones, header del admin |
| `verde-600` | `#3A6450` | Iconos secundarios, foco visible |
| `verde-500` | `#4C7A63` | Decorativo, gráficos discretos |
| `verde-200` | `#B8CBBF` | Bordes suaves sobre verde oscuro |
| `verde-100` | `#DFE9E2` | Tint de fondo en estados y rangos |
| `verde-50` | `#EEF3EF` | Fondo de hover y selecciones suaves |

Justificación: el verde profundo evoca la vegetación tropical y el trato de casa del hotel, aporta autoridad serena en una ciudad tropical y domina con contraste sobre los neutros cálidos.

### Neutrales — papel cálido (fondos y texto)

| Token | Hex | Uso |
|---|---|---|
| `blanco-cálido` | `#FBF9F4` | Fondos principales, tarjetas, inputs |
| `arena-100` | `#F3EFE6` | Fondos alternos, tarjetas agrupadas |
| `arena-300` | `#DCD5C6` | Bordes, divisores, tracks de progreso |
| `arena-500` | `#A89F8E` | Placeholders, texto deshabilitado |
| `tinta-700` | `#4A473F` | Texto secundario, captions |
| `tinta-900` | `#23211D` | **Texto principal** |

### Acento — Bronce firma (CTA premium y detalles de lujo)

| Token | Hex | Uso |
|---|---|---|
| `bronce-500` | `#B08D57` | CTA premium (pago, add-ons), precios, paso actual |
| `bronce-600` | `#8C6B33` | Hover sobre bronce |
| `dorado-100` | `#F0E4CD` | Tint de selección de add-ons |

### Funcionales (apps)

| Token | Hex | Uso |
|---|---|---|
| `exito-700` / `exito-100` | `#1F6B4A` / `#DCEFE4` | Confirmaciones, badge "libre" |
| `error-700` / `error-100` | `#A63D2C` / `#F6DED8` | Errores, pago rechazado |
| `aviso-700` / `aviso-100` | `#9C7A1E` / `#F6ECD0` | Avisos, badge "limpieza" |

**Contraste AA (verificado por construcción):**
- Texto `tinta-900` sobre `blanco-cálido`: ~13:1 (AAA).
- Blanco sobre `verde-800`: ~10:1 · sobre `verde-700`: ~8:1 · sobre `exito-700` y `error-700`: >4.5:1.
- Bronce `#B08D57` sobre `verde-950`: ~5:1 (texto grande) — nunca se usa bronce para texto pequeño.
- Regla: texto siempre `tinta-900`/blanco; bronce y verde-500 solo para texto ≥18px o semibold.

---

## 3. Tipografía

Google Fonts, sin instalación local, cargadas con `preconnect` y `display=swap`.

- **Serif (títulos): Cormorant Garamond** — 500, 600, 700 + itálicas. Estilo editorial serio, rasgos altos que evocan imprenta clásica.
- **Sans (cuerpo): Manrope** — 400, 500, 700, 800. Legible en pantalla táctil, neutra y moderna, buen contraste de caja.

### Jerarquía (px)

| Nivel | Fuente | Móvil | Tablet (kiosco) | Desktop (admin) |
|---|---|---|---|---|
| H1 (título de pantalla) | Cormorant 500 | 34 | 40 | 48 |
| H2 (sección) | Cormorant 500 | 28 | 32 | 38 |
| H3 (tarjetas) | Cormorant 600 | 22 | 24 | 26 |
| Cuerpo | Manrope 400 · lh 1.6 | 16 | 17 | 18 |
| Caption | Manrope 600 · mayúsculas · tracking 0.08em | 12 | 13 | 13 |
| Botón / etiqueta | Manrope 700 · mayúsculas · tracking 0.06em | 13 | 14 | 14 |
| Precio | Cormorant 600 | 24 | 26 | 28 |

Reglas: H1 nunca en mayúsculas (se reserva para el logotipo); captions con tracking amplio para el aire editorial; itálica Cormorant para citas y notas de bienvenida.

---

## 4. Componentes clave

**Tokens base:** radio de esquinas 4/8/12 px (inputs 4, botones 8, tarjetas 12; pills solo en badges) — equilibrio editorial, nada de esquinas tipo app móvil. Sombras muy sutiles y cálidas (base tinta al 6-14 %): `sombra-1` 0 1px 2px, `sombra-2` 0 4px 12px, `sombra-3` 0 12px 32px. Espaciado en escala 4px (4, 8, 12, 16, 24, 32, 48, 64). Grid de 12 columnas: kiosco tablet gutter 16 / margen 24; desktop gutter 24 / margen 48, contenedor máx. 1200px.

- **Botón primario:** fondo `verde-800`, texto `blanco-cálido`, Manrope 700 14px mayúsculas, radio 8, alto mínimo 48px (táctil), pad 16×24. Hover `verde-700` + `sombra-2`; activo traslación 1px.
- **Botón secundario:** borde 1px `verde-700`, texto `verde-800`, fondo transparente, mismas medidas; hover fondo `verde-50`. **CTA premium:** fondo `bronce-500`, texto `verde-950`, hover `bronce-600`.
- **Tarjeta de cuarto:** fondo `blanco-cálido`, radio 12, `sombra-1`. Foto 16:10 arriba, pad 16; título Cormorant 24; línea divisoria 1px `arena-300`; precio `bronce-500` Cormorant 600; badges al pie. Hover `sombra-3` + `translateY(-2px)`.
- **Tarjeta de add-on:** fondo blanco, borde 1px `arena-300`, radio 12; selector circular de 24px a la derecha. Seleccionado: borde 2px `bronce-500`, fondo `dorado-100`, check `verde-950`. No seleccionado: borde `arena-300`.
- **Campo de formulario:** label caption Manrope 700 `tinta-700`; input fondo `blanco-cálido`, borde 1px `arena-300`, radio 4, pad 14×12; foco: borde `verde-600` + anillo 3px `verde-100`. Error: borde `error-700` + mensaje caption con icono.
- **Input de fecha:** igual al campo con icono de calendario 20px; fecha seleccionada en `verde-800` semibold; rangos con banda `verde-100`; día actual marcado con anillo bronce.
- **Badge de estado (pill):** dot 6px + label Manrope 700 12px mayúsculas, fondo tint 100, texto 700. Libre: `exito` · Ocupado: `bronce-600` con texto blanco · Limpieza: `aviso-700` · Bloqueado: fondo `arena-300`, texto `tinta-700`.
- **Alerta / error:** fondo `error-100`, borde izquierdo 4px `error-700`, icono 20px, texto `tinta-900` 14px, radio 8. Variantes éxito (`exito-100`/`exito-700`) y aviso (`aviso-100`/`aviso-700`).
- **Header del kiosco:** barra de 64px, fondo `blanco-cálido` con borde inferior 1px `arena-300` (variante oscura: fondo `verde-900`). Logotipo a la izquierda, hora local y selector de idioma a la derecha, nunca más de 3 elementos.
- **Barra de progreso:** 5 pasos (Bienvenida, Habitación, Extras, Pago, Confirmación). Puntos de 12px unidos por línea de 2px `arena-300`. Completado: `verde-800` con check blanco · Actual: `bronce-500` con pulso suave · Futuro: `arena-300`. Labels caption debajo de cada punto.

---

## 5. Logotipo

**Wordmark "HOTEL DEL VALLE"** — solo tipografía, sin icono complejo:

- Composición apilada: **"HOTEL"** en Cormorant Garamond 500, mayúsculas, tracking amplio de 0.35em, tamaño al 40 % de la línea principal; **"DEL VALLE"** en Cormorant 600, mayúsculas, tracking 0.12em. La frase "DEL VALLE" es la protagonista: ancha, sólida, serena. Opcional: tagline caption "GUAYAQUIL · ECUADOR" bajo el bloque.
- Variante oscura: texto `blanco-cálido` sobre `verde-900` o fotografía oscura del hotel. Variante clara: `verde-950` sobre `blanco-cálido`/papel. Prohibido: sombras, degradados, rellenos de color en las letras.
- Monograma opcional **HV** (Cormorant 700, la H y la V entrelazadas a la altura de la caja) para favicon, avatar y wallet de pago.
- Espacio libre: el doble del alto de la palabra "HOTEL" en los cuatro lados (mínimo 8px); nunca rodeado de otro texto a menos de esa distancia. No se escala por debajo de 32px de ancho total.

---

## 6. Motion

Solo tres reglas, todas discretas y respetuosas de `prefers-reduced-motion` (en ese caso: solo fade, 120ms):

1. **Transición de pasos del kiosco (fade + slide lento):** la pantalla entrante sube 12px mientras funde de 0 a 1 en 280-320ms con `ease-out`. Nunca más rápido: el kiosco debe sentirse pausado y lujoso, no ágil ni nervioso.
2. **Hover suave en tarjetas:** 200ms `ease`, `translateY(-2px)` + `sombra-2 → sombra-3`. En táctil, feedback táctil de 100ms con escala 0.99 al tocar (no se arrastra).
3. **Indicador de carga elegante:** línea de 2px de ancho total en `verde-800` con un brillo `bronce-500` que barre de izquierda a derecha en 1.2s en loop; el progreso real avanza con un cambio sutil de tonalidad. Sin spinners infantiles: la línea dorada ES la marca en movimiento.

---

## Resumen ejecutivo

1. **Concepto creativo:** "El descanso en el centro de Guayaquil" — boutique editorial cálido; la interfaz evoca un cuaderno de viajero con luz de tarde, sábanas blancas y madera, calma frente a la ciudad.
2. **Paleta principal:** verde profundo `#1F3A2D`, neutros cálidos `#FBF9F4` / tinta `#23211D`, acento bronce `#B08D57`; funcionales `#1F6B4A` (éxito), `#A63D2C` (error), `#9C7A1E` (aviso); todo con contraste AA verificado.
3. **Tipografía:** Cormorant Garamond (serif editorial, títulos) + Manrope (sans moderna, cuerpo y controles), ambas de Google Fonts.
4. **Look final:** verde profundo como autoridad serena, papel cálido, bronce como firma de lujo, esquinas de 8-12px, sombras sutiles, grid de 4px — sofisticado y local, sin rastro corporativo genérico.
5. **Sistema coherente** entre kiosco táctil apaisado y admin de escritorio: mismas paleta, jerarquía, radios y motion, para que huésped y operador reconozcan la misma casa.
