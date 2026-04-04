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
        /* ── Warm-gray surface system ─────────────────── */
        surface: {
          base:     '#DFDFD5',
          elevated: '#F1F2EF',
          muted:    '#C2C1BB',
          inset:    '#D5D5CB',
        },
        frame: {
          DEFAULT:  '#5D5D58',
          dark:     '#4A4A45',
        },
        /* ── Lime accent ──────────────────────────────── */
        accent: {
          DEFAULT:  '#E9F34A',
          bright:   '#F3FE48',
          text:     '#3D4009',
        },
        /* ── Semantic text ────────────────────────────── */
        ink: {
          DEFAULT:  '#1E1E1A',
          secondary:'#6E6E67',
          muted:    '#8A8A84',
          onDark:   '#F1F2EF',
        },
        /* ── Chips & chart ────────────────────────────── */
        chip: {
          DEFAULT:  '#73756E',
          hover:    '#5D5D58',
        },
        chartGray:  '#A2A29B',
        /* ── Soft status ──────────────────────────────── */
        status: {
          red:        '#D08C84',
          'red-text': '#8B3A30',
          yellow:     '#E5D86A',
          green:      '#96B38A',
          'green-text':'#2D5E1E',
        },
        /* ── Legacy alias (keep until all refs migrated) */
        primary: {
          50:  '#F1F2EF',
          100: '#E4E5DF',
          200: '#D5D5CB',
          300: '#C2C1BB',
          400: '#A2A29B',
          500: '#73756E',
          600: '#5D5D58',
          700: '#4A4A45',
          800: '#3A3A36',
          900: '#1E1E1A',
          950: '#0F0F0D',
        },
        clinical: {
          50:  '#f0faf1',
          100: '#d4f0d8',
          200: '#b3e3ba',
          300: '#96B38A',
          400: '#7aa26e',
          500: '#5e9152',
          600: '#4a7a3f',
          700: '#3a6332',
          800: '#2D5E1E',
          900: '#1e4a14',
        },
      },
      borderRadius: {
        'shell':  '42px',
        'card':   '30px',
        'input':  '22px',
        'pill':   '999px',
        'btn':    '20px',
        'icon':   '999px',
        'sm-el':  '16px',
        'lg':     '18px',
        'xl':     '24px',
        '2xl':    '30px',
        '3xl':    '36px',
        'md':     '16px',
      },
      boxShadow: {
        'soft':     '0 1px 3px rgba(30,30,26,0.035)',
        'card':     '0 8px 24px rgba(30,30,26,0.05)',
        'elevated': '0 12px 30px rgba(30,30,26,0.08)',
        'dropdown': '0 18px 40px rgba(30,30,26,0.14)',
      },
      fontSize: {
        'hero':    ['2rem',    { lineHeight: '1.2', fontWeight: '700' }],
        'heading': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
        'metric':  ['1.75rem', { lineHeight: '1.2', fontWeight: '700' }],
        'body':    ['0.9375rem', { lineHeight: '1.6' }],
        'label':   ['0.8125rem', { lineHeight: '1.4', fontWeight: '500' }],
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
