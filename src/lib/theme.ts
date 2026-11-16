export const THEME_COOKIE = "ledger_theme";
export type Theme = "system" | "light" | "dark";
export const parseTheme = (v: string | undefined): Theme => (v === "light" || v === "dark" ? v : "system");
