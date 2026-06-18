export const colors = {
  dark: "#2e3440",
  mutedText: "#4c566a",
  lightBorder: "#d8dee9",
  lightBg: "#e5e9f0",
  lighterBg: "#eceff4",
  teal: "#8fbcbb",
  primary: "#5e81ac",
  danger: "#bf616a",
  orange: "#d08770",
  yellow: "#ebcb8b",
  green: "#a3be8c",
}

export type ButtonVariant = "success" | "danger" | "warning"

export interface ButtonVariantStyles {
  idle: { bg: string; color: string }
  pending: { bg: string; color: string }
}

export const buttonVariants: Record<ButtonVariant, ButtonVariantStyles> = {
  success: {
    idle: { bg: colors.primary, color: "#fff" },
    pending: { bg: "#4a7098", color: "#fff" },
  },
  danger: {
    idle: { bg: colors.danger, color: "#fff" },
    pending: { bg: "#e65100", color: "#fff" },
  },
  warning: {
    idle: { bg: colors.yellow, color: colors.dark },
    pending: { bg: colors.orange, color: "#fff" },
  },
}
