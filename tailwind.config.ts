import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)", panel: "var(--panel)",
        ink: "var(--ink)", "ink-soft": "var(--ink-soft)",
        line: "var(--line)", "line-strong": "var(--line-strong)",
        accent: "var(--accent)", "accent-tint": "var(--accent-tint)",
        warn: "var(--warn)", "warn-tint": "var(--warn-tint)",
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: { card: "0 1px 2px rgba(20,25,20,.04), 0 10px 30px -14px rgba(20,25,20,.12)" },
    },
  },
  plugins: [],
};
export default config;
