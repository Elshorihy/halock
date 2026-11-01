/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07080c",
          900: "#0b0d13",
          850: "#101320",
          800: "#151a2a",
          700: "#1e2438",
          600: "#2a3250",
        },
        violet: {
          glow: "#8b5cf6",
          deep: "#6d28d9",
        },
        focus: {
          DEFAULT: "#22d3ee",
          dim: "#0e7490",
        },
      },
      fontFamily: {
        sans: [
          "'IBM Plex Sans Arabic'",
          "'Cairo'",
          "'Noto Kufi Arabic'",
          "'Segoe UI'",
          "Tahoma",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(2, 6, 23, 0.45)",
        "focus-ring": "0 0 24px rgba(34, 211, 238, 0.35)",
      },
      backgroundImage: {
        "halock-radial":
          "radial-gradient(1200px 600px at 80% -10%, rgba(139, 92, 246, 0.18), transparent 60%), radial-gradient(900px 500px at 10% 110%, rgba(34, 211, 238, 0.12), transparent 55%)",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
