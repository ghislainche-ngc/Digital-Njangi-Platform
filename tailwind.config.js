/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './login.html',
    './register.html',
    './app/**/*.html',
    './src/**/*.{js,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      colors: {
        // Monochrome black/white — no chromatic accent
        brand: {
          50:  '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#18181b',
          950: '#09090b',
        },
        ink: {
          50:  '#fafafa',
          100: '#f4f4f5',
          200: '#e4e4e7',
          300: '#d4d4d8',
          400: '#a1a1aa',
          500: '#71717a',
          600: '#52525b',
          700: '#3f3f46',
          800: '#27272a',
          900: '#0a0a0a',
          950: '#000000',
        },
        success: '#10b981',
        warning: '#f59e0b',
        danger:  '#ef4444',
        info:    '#3b82f6',
      },
      boxShadow: {
        'glass-sm': '0 4px 16px -2px rgba(16, 19, 31, 0.12)',
        'glass':    '0 12px 40px -8px rgba(16, 19, 31, 0.25)',
        'glass-lg': '0 24px 64px -12px rgba(16, 19, 31, 0.35)',
        'brand':    '0 10px 30px -10px rgba(0, 0, 0, 0.35)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 400ms ease-out both',
        'float':   'float 4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
