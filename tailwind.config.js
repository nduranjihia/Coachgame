/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-0': '#14101F',
        'bg-1': '#1E1730',
        'bg-2': '#2A2142',
        'bg-3': '#382C58',
        ink: '#FFF6E9',
        'ink-dim': '#B9AED0',
        line: 'rgba(255,246,233,.12)',
        coral: '#FF6B6B',
        sun: '#FFC857',
        mint: '#3DDC97',
        sky: '#4DB8FF',
        grape: '#A78BFA',
        rose: '#FF7EB6',
        'card-red': '#FF5A5F',
        'card-yellow': '#FFC83D',
        'card-green': '#34D399',
        'card-blue': '#4DA3FF',
        danger: '#FF4D4D',
        ok: '#3DDC97',
      },
      borderRadius: {
        sm: '14px',
        DEFAULT: '22px',
        lg: '32px',
      },
      fontFamily: {
        display: ["'Lilita One'", "'Fredoka'", 'ui-rounded', 'system-ui', 'sans-serif'],
        body: ["'Fredoka'", 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        hard: '0 6px 0 rgba(0,0,0,.35)',
        'hard-sm': '0 2px 0 rgba(0,0,0,.35)',
        soft: '0 18px 40px rgba(0,0,0,.35)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.34,1.56,.64,1)',
      },
    },
  },
  plugins: [],
};
