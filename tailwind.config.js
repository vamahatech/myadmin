/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        bg:      'var(--color-bg)',
        surface: 'var(--color-surface)',
        card:    'var(--color-card)',
        primary: 'var(--color-primary)',
        accent:  'var(--color-accent)',
        gold:    'var(--color-gold)',
        success: 'var(--color-success)',
        danger:  'var(--color-danger)',
        text:    'var(--color-text)',
        text2:   'var(--color-text2)',
        border:  'var(--color-border)',
      },
      fontFamily: {
        sans: ['Manrope', 'Hind', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Hind', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
