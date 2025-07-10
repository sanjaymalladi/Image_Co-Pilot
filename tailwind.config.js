/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#ffffff', // white
        secondary: '#000000', // black
        muted: '#676767', // grey
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}; 