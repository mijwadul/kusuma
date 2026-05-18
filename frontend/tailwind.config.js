/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0F172A',      // Deep Navy
          darker: '#0B1329',    // Very Deep Navy (Hover/Mobile Header)
          light: '#F8FAFC',     // Application Background
          card: '#FFFFFF',      // Cards & Modals Background
        },
        accent: {
          DEFAULT: '#0D9488',   // Sea Teal
          hover: '#0F766E',     // Darker Teal for Hover
          focus: '#2DD4BF',     // Teal Focus Ring
        },
        status: {
          success: {
            bg: '#E6F4EA',
            text: '#137333',
            border: '#CEEAD6',
          },
          pending: {
            bg: '#FEF3C7',
            text: '#D97706',
            border: '#FDE68A',
          },
          danger: {
            bg: '#FCE8E6',
            text: '#C5221F',
            border: '#FAD2CF',
          },
          info: {
            bg: '#E8F0FE',
            text: '#1A73E8',
            border: '#D2E3FC',
          }
        }
      }
    },
  },
  plugins: [],
}