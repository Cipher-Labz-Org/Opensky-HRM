import palette from "./palette.js";

/** Login / auth palette — logo-aligned (OPEN navy, SKY cyan, HRM green) */
export const LOGIN_THEME = {
  navy: palette.navy,
  skyBlue: palette.skyBlue,
  green: palette.accent,
  background: palette.background,
  muted: palette.muted,
  border: palette.border,
  fieldBg: palette.fieldBg,
  cardShadow: {
    shadowColor: palette.navy,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 8,
  },
} as const;
