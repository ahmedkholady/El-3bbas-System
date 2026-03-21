/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#fdfcf9',
          100: '#f9f5ec',
          200: '#f0e6cf',
          300: '#e1cea1',
          400: '#ccaf6f',
          500: '#c5a059', // Main Gold
          600: '#b18e4a',
          700: '#91733e',
          800: '#725a33',
          900: '#5e4a2b',
        },
        dark: {
          800: '#2a2420',
          900: '#1a1614', // Main Dark Brown
        },
      },
      fontFamily: {
        sans: ['Tajawal', 'sans-serif'],
      },
    },
  },
  plugins: [],
};