/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 15px -3px rgb(15 23 42 / 0.07), 0 10px 20px -5px rgb(15 23 42 / 0.06)',
        'soft-dark': '0 2px 20px -3px rgb(0 0 0 / 0.45), 0 8px 28px -8px rgb(16 185 129 / 0.12)',
        glow: '0 0 0 1px rgb(16 185 129 / 0.08), 0 12px 40px -12px rgb(16 185 129 / 0.25)',
        'glow-dark': '0 0 0 1px rgb(52 211 153 / 0.15), 0 12px 48px -12px rgb(16 185 129 / 0.2)',
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 8px 24px -4px rgb(15 23 42 / 0.08)',
        'card-dark': '0 1px 2px rgb(0 0 0 / 0.35), 0 12px 32px -8px rgb(0 0 0 / 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        shimmer: 'shimmer 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      backgroundSize: {
        '200': '200% 100%',
      },
    },
  },
  plugins: [],
}
