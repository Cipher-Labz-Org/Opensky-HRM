const palette = require("./src/theme/palette.js");

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: palette.primary,
          dark: palette.primaryDeep,
          light: palette.primarySoft,
        },
        navy: {
          DEFAULT: palette.navy,
          mid: palette.navyMid,
        },
        accent: {
          DEFAULT: palette.accent,
          soft: palette.accentSoft,
        },
        action: palette.action,
        sky: palette.skyBlue,
        teal: {
          DEFAULT: palette.teal,
          soft: palette.tealSoft,
        },
        surface: palette.surface,
        soft: palette.soft,
        background: palette.background,
        border: palette.border,
        ink: palette.text,
        muted: palette.muted,
        danger: palette.danger,
        success: palette.success,
        warning: palette.warning,
        successSoft: palette.successSoft,
        warningSoft: palette.warningSoft,
        dangerSoft: palette.dangerSoft,
      },
    },
  },
  plugins: [],
};
