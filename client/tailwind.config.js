/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        finBg: '#FFFFFF',
        finSurface: '#F9F9F8',
        finHover: '#F4F4F2',
        finBorder: '#E5E5E3',
        finBorderLight: '#EFEFEF',
        finBlack: '#0A0A0A',
        finMuted: '#737373',
        finGreen: '#16A34A',
        finRed: '#DC2626'
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
} 