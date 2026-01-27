/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nothing: {
          black: '#000000',
          white: '#FFFFFF',
          gray: '#A1A1A1',
          darkgray: '#333333',
          red: '#D71920',
        }
      },
      fontFamily: {
        dot: ['"VT323"', 'monospace'],
        mono: ['"Space Mono"', 'monospace'],
      },
      borderRadius: {
        'nothing': '24px',
      }
    },
  },
  plugins: [],
}
