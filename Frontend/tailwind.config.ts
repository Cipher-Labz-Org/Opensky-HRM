import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    // Explicit paths for Next route groups / dynamic segments so Tailwind always scans them
    // (broad `**` globs can miss folders named `(group)` or `[param]` on some platforms).
    "./app/(marketing)/**/*.{js,ts,jsx,tsx,mdx}",
    // In globs, `[` `]` are special; escape so `[id]` is not treated as a character class.
    "./app/app/people/\\[id\\]/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/app/recruitment/candidate/\\[id\\]/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/tenant/\\[tenant\\]/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
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
