/** Colors are CSS variables (theme-switchable hex), which Tailwind can't
 *  split into channels — so opacity modifiers like bg-success/10 would
 *  silently produce nothing. color-mix() with <alpha-value> makes them work. */
const withAlpha = (v) => `color-mix(in srgb, var(${v}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        bg:      withAlpha('--color-bg'),
        surface: withAlpha('--color-surface'),
        card:    withAlpha('--color-card'),
        primary: withAlpha('--color-primary'),
        accent:  withAlpha('--color-accent'),
        gold:    withAlpha('--color-gold'),
        success: withAlpha('--color-success'),
        danger:  withAlpha('--color-danger'),
        warning: withAlpha('--color-warning'),
        'primary-hover': withAlpha('--color-primary-hover'),
        text:    withAlpha('--color-text'),
        text2:   withAlpha('--color-text2'),
        border:  withAlpha('--color-border'),
        sage:    withAlpha('--color-sage'),
        hover:   withAlpha('--color-hover'),
        pressed: withAlpha('--color-pressed'),
        focus:   withAlpha('--color-focus'),
        blue:    withAlpha('--color-blue'),
        'chart-1': withAlpha('--color-chart-1'),
        'chart-2': withAlpha('--color-chart-2'),
        'chart-3': withAlpha('--color-chart-3'),
      },
      fontFamily: {
        sans: ['Manrope', 'Hind', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Hind', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
