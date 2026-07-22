/** OpenSky product palette — aligned with login / mobile */
export const OPENSKY_THEME = {
  navy: "#081F3E",
  navyMid: "#1E3A8A",
  navyDeep: "#0A2540",
  accent: "#76B82A",
  accentSoft: "#EEF6E4",
  /** Primary action / CTA — landing page cyan */
  action: "#28A9E0",
  actionSoft: "#E8F6FC",
  teal: "#28A9E0",
  tealSoft: "#E8F6FC",
  background: "#F4F8FC",
  surface: "#ffffff",
  primaryLight: "#E8EEF7",
  soft: "#EEF4FA",
  border: "#D4DEE8",
  muted: "#5B7087",
  warning: "#D97706",
  danger: "#DC2626",
} as const;

export const softCardShadow =
  "0 8px 32px rgba(8, 31, 62, 0.08), 0 2px 8px rgba(8, 31, 62, 0.04)";

export const softPageBackground =
  "radial-gradient(ellipse 90% 60% at 50% -10%, rgba(40,169,224,0.1), transparent 55%), radial-gradient(ellipse 70% 50% at 100% 100%, rgba(118,184,42,0.06), transparent 45%), linear-gradient(180deg, #F4F8FC 0%, #EEF4FA 100%)";

/** Login page palette — matches brand mockup */
export const LOGIN_THEME = {
  navy: "#173A63",
  skyBlue: "#2E7BBF",
  green: "#76B82A",
  background: "#F4F8FC",
  muted: "#5B7087",
  border: "#E2E8F0",
  cardShadow: "0 20px 60px rgba(8, 31, 62, 0.10)",
} as const;

/** Login wave SVG layers — derived from LOGIN_THEME + OPENSKY_THEME */
export const LOGIN_WAVE = {
  navyDeep: OPENSKY_THEME.navy,
  navy: LOGIN_THEME.navy,
  blueDeep: OPENSKY_THEME.navyMid,
  blueMid: LOGIN_THEME.skyBlue,
  blueLight: "#4A9AD4",
  greenDark: "#5FA022",
  green: LOGIN_THEME.green,
  greenLight: "#8BC93E",
  accentLight: "#D6EBF8",
  background: LOGIN_THEME.background,
  contourA: "#C5DFF0",
  contourB: "#D4E8F5",
  shadowDeep: "#7BA3C4",
  shadowMid: "#A8C5DE",
  shadowLight: "#C8DDF0",
  shadowPale: "#E2EEF8",
} as const;

export const DASH_CHART = {
  primary: OPENSKY_THEME.navyMid,
  secondary: OPENSKY_THEME.action,
  success: OPENSKY_THEME.accent,
  warning: OPENSKY_THEME.warning,
  danger: OPENSKY_THEME.danger,
  muted: "#94A3B8",
} as const;
