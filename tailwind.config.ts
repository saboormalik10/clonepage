import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#d4af37',
        // Gold Palette
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#d4af37',
          500: '#b8960b',
          600: '#996515',
          700: '#7c5a0b',
          800: '#5c4507',
        },
        // Charcoal Palette
        charcoal: {
          100: '#f5f5f5',
          200: '#d4d4d4',
          300: '#a3a3a3',
          400: '#737373',
          500: '#525252',
          600: '#3d3d3d',
          700: '#2d2d2d',
          800: '#222222',
          900: '#1a1a1a',
        },
        // Luxury accent colors
        ivory: '#fffef5',
        champagne: '#f7e7ce',
        cream: '#f5f0e6',
        'black-rich': '#0a0a0a',
        'black-soft': '#111111',
      },
      fontFamily: {
        body: ['var(--font-body)', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
      },
      boxShadow: {
        'gold': '0 4px 20px -2px rgba(212, 175, 55, 0.25)',
        'gold-hover': '0 8px 30px -2px rgba(212, 175, 55, 0.35)',
      },
    },
  },
  plugins: [],
}
export default config

