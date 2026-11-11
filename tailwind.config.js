/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nexus: {
          // Verde (§7.1 do documento de requisitos)
          green: '#10B981',
          'green-brand': '#00A859',
          'green-dark': '#047857',
          'green-deep': '#064E3B',
          'green-light': '#ECFDF5',
          'green-soft': '#D1FAE5',
          // Preto
          black: '#09090B',
          surface: '#18181B',
          'surface-alt': '#27272A',
          // Branco
          white: '#FFFFFF',
          off: '#F4F4F5',
          border: '#E4E4E7',
          // Alertas operacionais (§7.2)
          amber: '#F59E0B',
          red: '#EF4444',
        },
      },
    },
  },
  plugins: [],
};

