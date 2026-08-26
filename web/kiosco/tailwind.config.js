/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'verde': {
          900: '#143A2A',
          700: '#1B4A35',
          600: '#2C6B4A',
          500: '#3E9A63',
        },
        'crema': '#F3ECDD',
        'ink': '#10281D',
      },
      fontFamily: {
        'serif': ['"Cormorant Garamond"', 'Georgia', 'serif'],
        'sans': ['Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 12px 32px -12px rgba(20,58,42,0.30)',
        'soft-lg': '0 24px 60px -20px rgba(20,58,42,0.40)',
      }
    }
  },
  plugins: []
}
