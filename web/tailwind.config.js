/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        sidebarBg: '#ffffff',
        dashboardBg: '#ffffff',
        bannerBg: '#f7f6f0',
        cardBg: '#ffffff',
        cardDark: '#1c1b1f',
        borderSoft: '#ecebe4',
        badgeBg: '#f1f0e9',
      },
    },
  },
  plugins: [],
}