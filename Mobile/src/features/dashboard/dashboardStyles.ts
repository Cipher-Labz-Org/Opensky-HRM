import { softCardShadow } from "@/theme/colors";
import { LOGIN_THEME } from "@/theme/loginTheme";

export { softCardShadow };

export const dashboardBackground = {
  backgroundColor: LOGIN_THEME.background,
} as const;

export const dashboardCardStyle = {
  borderColor: LOGIN_THEME.border,
  ...LOGIN_THEME.cardShadow,
} as const;
