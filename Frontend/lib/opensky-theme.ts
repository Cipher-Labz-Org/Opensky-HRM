/** OpenSky product palette — aligned with login / mobile */
export const OPENSKY_THEME = {
  navy: "#081F3E",
  navyMid: "#1E3A8A",
  navyDeep: "#0A2540",
  accent: "#76B82A",
  accentSoft: "#EEF6E4",
  background: "#F4F8FC",
  surface: "#ffffff",
  primaryLight: "#E8EEF7",
  border: "#D4DEE8",
  muted: "#5B7087",
  warning: "#D97706",
  danger: "#DC2626",
} as const;

export const DASH_CHART = {
  primary: OPENSKY_THEME.navyMid,
  secondary: OPENSKY_THEME.accent,
  success: OPENSKY_THEME.accent,
  warning: OPENSKY_THEME.warning,
  danger: OPENSKY_THEME.danger,
  muted: "#94A3B8",
} as const;
