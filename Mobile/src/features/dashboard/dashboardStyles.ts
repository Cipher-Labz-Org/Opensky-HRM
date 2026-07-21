import { colors } from "@/theme/colors";

export const softCardShadow = {
  shadowColor: colors.navy,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
  elevation: 4,
} as const;

export const dashboardBackground = {
  backgroundColor: colors.background,
} as const;
