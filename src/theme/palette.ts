export type Palette = {
  primary: string;
  gradientStart: string;
  gradientEnd: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
};

export const lightPalette: Palette = {
  primary: "#2563EB",
  gradientStart: "#3B82F6",
  gradientEnd: "#1D4ED8",
  background: "#F4F6FB",
  surface: "#FFFFFF",
  surfaceMuted: "#EDF2FA",
  border: "#E3E9F3",
  textPrimary: "#0F172A",
  textSecondary: "#5B6B84",
  textMuted: "#94A3B8",
  success: "#16A34A",
  successSoft: "#E3F6EA",
  warning: "#D97706",
  warningSoft: "#FEF1DC",
  danger: "#EF4444",
  dangerSoft: "#FDE8E8",
  info: "#8B5CF6",
  infoSoft: "#EDE9FE",
};

export const darkPalette: Palette = {
  primary: "#3B82F6",
  gradientStart: "#2E6BEE",
  gradientEnd: "#132E6B",
  background: "#0B1220",
  surface: "#121B2E",
  surfaceMuted: "#1B2740",
  border: "#263352",
  textPrimary: "#E7EEF9",
  textSecondary: "#A8B6CE",
  textMuted: "#5F6F8C",
  success: "#22C55E",
  successSoft: "#10301D",
  warning: "#FBBF24",
  warningSoft: "#33280C",
  danger: "#F87171",
  dangerSoft: "#3A1A1C",
  info: "#A78BFA",
  infoSoft: "#241D45",
};