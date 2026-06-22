/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      colors: {
        cream: {
          DEFAULT: "#F0EDE4",
          dark: "#E8E4DA",
          border: "#DDD9CE",
        },
        card: "#F7F5F0",
        ink: "#111110",
      },
    },
  },
  plugins: [],
};
