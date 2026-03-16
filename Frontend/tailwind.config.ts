import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Aligned with hris_ui_pack CSS variables
        panel: "var(--panel)",
        soft: "var(--soft)",
        primary: {
          DEFAULT: "var(--primary)",
          soft: "var(--primary-soft)",
        },
        muted: "var(--muted)",
        border: "var(--border)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "var(--shadow)",
      },
    },
  },
  plugins: [],
};

export default config;
