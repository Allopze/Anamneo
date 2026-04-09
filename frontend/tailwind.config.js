/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ── Warm-cream surface system ────────────────── */
        surface: {
          base:     '#ebe9e4',
          elevated: '#fdfcfb',
          muted:    '#e5e4e0',
          inset:    '#f5f4f0',
        },
        frame: {
          DEFAULT:  '#404040',
          dark:     '#2b2b2b',
        },
        /* ── Lime accent ──────────────────────────────── */
        accent: {
          DEFAULT:  '#eaf832',
          bright:   '#f3fe48',
          text:     '#2b2b2b',
        },
        /* ── Semantic text ────────────────────────────── */
        ink: {
          DEFAULT:  '#2b2b2b',
          primary:  '#2b2b2b',
          secondary:'#555555',
          muted:    '#767676',
          onDark:   '#ffffff',
        },
        /* ── Chips & chart ────────────────────────────── */
        chip: {
          DEFAULT:  '#555555',
          hover:    '#404040',
        },
        chartGray:  '#767676',
        /* ── Soft status ──────────────────────────────── */
        status: {
          red:        '#D08C84',
          'red-text': '#7f1d1d',
          yellow:     '#E5D86A',
          green:      '#96B38A',
          'green-text':'#1a5d38',
        },
        /* ── Legacy alias (keep until all refs migrated) */
        primary: {
          50:  '#fdfcfb',
          100: '#f5f4f0',
          200: '#ebe9e4',
          300: '#e5e4e0',
          400: '#767676',
          500: '#555555',
          600: '#404040',
          700: '#2b2b2b',
          800: '#1a1a1a',
          900: '#111111',
          950: '#0a0a0a',
        },
        clinical: {
          50:  '#f0faf1',
          100: '#d1f4e0',
          200: '#b3e3ba',
          300: '#96B38A',
          400: '#7aa26e',
          500: '#5e9152',
          600: '#4a7a3f',
          700: '#3a6332',
          800: '#1a5d38',
          900: '#1e4a14',
        },
      },
      borderRadius: {
        'shell':  '2.5rem',
        'card':   '2rem',
        'input':  '999px',
        'pill':   '999px',
        'btn':    '999px',
        'icon':   '999px',
        'sm-el':  '1rem',
        'lg':     '1.25rem',
        'xl':     '1.5rem',
        '2xl':    '2rem',
        '3xl':    '2.5rem',
        'md':     '1rem',
      },
      boxShadow: {
        'soft':     '0 1px 4px rgba(43,43,43,0.04)',
        'card':     '0 8px 24px rgba(43,43,43,0.06)',
        'elevated': '0 12px 30px rgba(43,43,43,0.08)',
        'dropdown': '0 18px 40px rgba(43,43,43,0.12)',
      },
      fontSize: {
        'hero':    ['2rem',    { lineHeight: '1.2', fontWeight: '800' }],
        'heading': ['1.25rem', { lineHeight: '1.4', fontWeight: '700' }],
        'metric':  ['1.75rem', { lineHeight: '1.2', fontWeight: '800' }],
        'body':    ['0.9375rem', { lineHeight: '1.6' }],
        'label':   ['0.8125rem', { lineHeight: '1.4', fontWeight: '600' }],
        'micro':   ['0.75rem',   { lineHeight: '1.4' }],
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '4.5': '1.125rem',
        '18': '4.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s infinite',
        'scale-in': 'scaleIn 0.15s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(-4px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
