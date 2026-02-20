module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F172A',
          700: '#0B1220'
        },
        indigo: '#1E293B',
        accent: '#06D6A0',
        success: '#10B981',
        warning: '#FBBF24',
        danger: '#EF4444',
        surface: '#0F172A',
        page: '#0A0F1F',
        muted: '#94A3B8'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial']
      },
      boxShadow: {
        card: '0 10px 30px rgba(2,6,23,0.6)'
      }
    },
  },
  plugins: [],
}
