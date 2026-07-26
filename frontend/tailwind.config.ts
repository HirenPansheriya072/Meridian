import type { Config } from 'tailwindcss';

/**
 * "Terminator line" palette.
 *
 * Named for the line dividing day from night as it sweeps the globe -- which is
 * literally what this app is about. Every scheduling tool on the market is
 * Calendly blue on white; this one is built from the colours of a day: deep dusk
 * navy for the chrome, a warm dawn amber for the booker's own time, sea green for
 * the host's. When two zones appear side by side, they are never the same colour.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chalk: '#F4F3EF',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#14171D',
          muted: '#5A6070',
          faint: '#8A909E',
        },
        rule: {
          DEFAULT: '#E0DFD9',
          strong: '#C7C5BD',
        },
        dusk: {
          DEFAULT: '#2B3A67',
          dark: '#1E2A4D',
          soft: '#E7EAF3',
        },
        dawn: {
          DEFAULT: '#C2703B',
          dark: '#9B562A',
          soft: '#FBEDE2',
        },
        sea: {
          DEFAULT: '#2E7268',
          soft: '#E3EFEC',
        },
        good: '#2E7268',
        warn: '#9B7328',
        bad: '#A33B2C',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { sm: '2px', DEFAULT: '4px', md: '6px', lg: '8px', xl: '12px' },
      boxShadow: {
        card: '0 1px 2px rgba(20,23,29,0.04)',
        lift: '0 10px 30px -12px rgba(20,23,29,0.2)',
        pop: '0 20px 50px -16px rgba(20,23,29,0.3)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'translate(-50%, -48%) scale(0.98)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-up': 'slide-up 200ms cubic-bezier(0.22,1,0.36,1)',
        'scale-in': 'scale-in 160ms cubic-bezier(0.22,1,0.36,1)',
      },
    },
  },
  plugins: [],
};

export default config;
