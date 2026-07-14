import type { Config } from 'tailwindcss';

export default <Partial<Config>>{
  content: [],
  theme: {
    extend: {
      colors: {
        lux: {
          black: '#0A0A0A',
          'black-2': '#111111',
          'black-3': '#1A1A1A',
          gold: '#C8A96E',
          'gold-light': '#E2C98A',
          'gold-dark': '#9A7A45',
          white: '#F5F0E8',
          'white-dim': '#B8B0A0',
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        body: ['Montserrat', 'sans-serif'],
      },
      letterSpacing: {
        lux: '0.2em',
      },
      boxShadow: {
        lux: '0 12px 40px rgba(200,169,110,0.25)',
      },
    },
  },
  plugins: [],
};
