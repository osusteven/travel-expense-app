import type { Metadata, Viewport } from "next";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";
import { cookies } from "next/headers";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Travel Ledger",
  description: "Shared travel expenses and who owes whom.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#5b47e0",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // This device's appearance choice (System / Light / Dark), set on <html> so the right colors load immediately.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" className="h-full antialiased" data-theme={theme === "system" ? undefined : theme}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
