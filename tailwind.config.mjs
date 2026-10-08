/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/renderer/index.html", "./src/renderer/src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-subtle": "var(--bg-subtle)",
        panel: "var(--panel)",
        border: "var(--border)",
        text: "var(--text)",
        "text-weak": "var(--text-weak)",
        accent: "var(--accent)"
      }
    }
  },
  plugins: []
};
