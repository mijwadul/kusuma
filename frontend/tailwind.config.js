/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'floating': '0 10px 40px -10px rgba(0,0,0,0.08)',
        '3d': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.5), inset 0 -2px 0 rgba(0, 0, 0, 0.05)',
        '3d-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.7), inset 0 -3px 0 rgba(0, 0, 0, 0.08)',
        '3d-pressed': 'inset 0 4px 6px -1px rgba(0, 0, 0, 0.1), inset 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
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
          light: '#CCFBF1',     // Very light teal for backgrounds
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