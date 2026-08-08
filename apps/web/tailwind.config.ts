export default {
  content: [],
  theme: {
    extend: {
      colors: {
        lux: {
          black: 'var(--black)',
          'black-2': 'var(--black-2)',
          'black-3': 'var(--black-3)',
          gold: 'var(--gold)',
          'gold-light': 'var(--gold-light)',
          'gold-dark': 'var(--gold-dark)',
          white: 'var(--white)',
          'white-dim': 'var(--white-dim)',
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
        lux: '0 12px 40px rgba(255,255,255,0.08)',
        'lux-gold': '0 12px 40px rgba(200,169,110,0.18)',
      },
    },
  },
  plugins: [],
};
