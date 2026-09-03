/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        // P1a responsive foundation: breakpoints kiosco + orientación
        // tablet-landscape tolerante (900px, no 1024px): el WebView del kiosco
        // 8" y tablets reportan <1024px de ancho en landscape.
        'kiosk-sm': '600px',
        'tablet-portrait': { raw: '(min-width: 600px) and (orientation: portrait)' },
        'tablet-landscape': { raw: '(min-width: 900px) and (orientation: landscape)' },
      },
      colors: {
        // Design tokens (web/tokens.css): paleta vigente 70/20/10 blanco+verde+bronce
        // navy (#0F172A legacy)  -> var(--hc-verde-900) #123526 / --hc-verde-950 #0f281e
        // OJO gold: el `gold` de Tailwind (#B08D57) es el acento bronce (solo precio
        // ≥24px, nunca CTA primario). Distinto a propósito del alias legacy `--gold`
        // de tokens.css (que apunta a verde-800): no unificar valores sin ADR
        // (rompería snapshots). Ver docs/brand/DECISION.md §2.
        // cream (#FBF7F0 legacy) -> var(--hc-blanco) #FFFFFF / --hc-papel #FBF9F4 / --hc-arena-100 #F3EFE6
        // sage (#6B8F71 aprox)   -> var(--hc-verde-200) #B8CBBF / --hc-verde-500 #3E9A63
        // Mantener tailwind keys legacy (navy/gold/cream) por compatibilidad; migrar gradual a --hc-* vía tokens.css
        navy: '#123526', // verde-900: fondos, texto, botones (antes navy #0F172A)
        gold: '#B08D57', // bronce: acento en precios, bordes activos (branding 03) — CTA es verde-800 no dorado
        cream: '#FBF7F0', // legacy compat -> var(--hc-blanco)
        sage: '#6B8F71', // legacy -> var(--hc-verde-200)
        slate: {
          DEFAULT: '#64748B',
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
