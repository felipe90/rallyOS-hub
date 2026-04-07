/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Typography sizes
    'text-[12px]', 'text-[14px]', 'text-[18px]', 'text-[28px]', 'text-[56px]', 'text-[80px]',
    'leading-[1.1]', 'leading-[1.2]', 'leading-[130%]', 'leading-[145%]',
    'tracking-[-1.68px]', 'tracking-[-0.56px]', 'tracking-[0.12px]', 'tracking-[0.14px]', 'tracking-[0.18px]',
    // Rounded with CSS variables
    'rounded-[--radius-sm]', 'rounded-[--radius-md]', 'rounded-[--radius-lg]', 'rounded-[--radius-xl]',
  ],
  theme: {
    colors: {
      background: 'var(--color-background)',
      'surface-low': 'var(--color-surface-low)',
      surface: 'var(--color-surface)',
      'surface-high': 'var(--color-surface-high)',
      text: 'var(--color-text)',
      'text-h': 'var(--color-text-h)',
      border: 'var(--color-border)',
      primary: 'var(--color-primary)',
      'primary-light': 'var(--color-primary-light)',
      'primary-dark': 'var(--color-primary-dark)',
      tertiary: 'var(--color-tertiary)',
      'tertiary-light': 'var(--color-tertiary-light)',
      'tertiary-dark': 'var(--color-tertiary-dark)',
      amber: 'var(--color-amber)',
      'amber-light': 'var(--color-amber-light)',
      // Include some standard Tailwind colors for utility
      white: '#ffffff',
      black: '#000000',
      transparent: 'transparent',
      slate: {
        100: '#f1f5f9',
        500: '#64748b',
        900: '#0f172a',
      },
      red: {
        500: '#ef4444',
      },
    },
    fontFamily: {
      heading: 'var(--font-heading)',
      body: 'var(--font-body)',
    },
    borderRadius: {
      sm: 'var(--radius-sm)',
      md: 'var(--radius-md)',
      lg: 'var(--radius-lg)',
      xl: 'var(--radius-xl)',
      full: 'var(--radius-full)',
    },
    boxShadow: {
      sm: 'var(--shadow-sm)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
      xl: 'var(--shadow-xl)',
    },
  },
  plugins: [],
}


