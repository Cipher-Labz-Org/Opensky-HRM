import palette from "./palette.js";

export const colors = {
  primary: palette.primary,
  primaryDark: palette.primaryDeep,
  primaryLight: palette.primarySoft,
  navy: palette.navy,
  navyMid: palette.navyMid,
  accent: palette.accent,
  accentSoft: palette.accentSoft,
  teal: palette.teal,
  tealSoft: palette.tealSoft,
  background: palette.background,
  surface: palette.surface,
  soft: palette.soft,
  border: palette.border,
  text: palette.text,
  muted: palette.muted,
  danger: palette.danger,
  dangerSoft: palette.dangerSoft,
  success: palette.success,
  successSoft: palette.successSoft,
  warning: palette.warning,
  warningSoft: palette.warningSoft,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
} as const;
