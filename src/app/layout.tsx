import type { Metadata, Viewport } from "next";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Travel Ledger",
  description: "Shared travel expenses and who owes whom.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#5b47e0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
