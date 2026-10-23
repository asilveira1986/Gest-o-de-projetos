/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        // azul-marinho: base "corporativa" da barra lateral e títulos
        ink: { 50: '#f4f6fa', 100: '#e6eaf2', 700: '#1e2a44', 800: '#16213a', 900: '#0f1830', 950: '#0a1124' },
        // verde-azulado: ação principal, progresso e saúde financeira
        brand: { 50: '#ecfdf8', 100: '#d1faec', 200: '#a7f3da', 300: '#6ee7c3', 400: '#34d3a8', 500: '#14b88c', 600: '#0d9373', 700: '#0f7860', 800: '#115e4d', 900: '#134e40' },
      },
    },
  },
  plugins: [],
}
