import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Imports upload a JSON backup through a server action (default limit is 1MB; Vercel's cap is 4.5MB).
    serverActions: { bodySizeLimit: "4mb" },
  },
  // The ledger is always rendered per request (it's behind a password and changes constantly),
  // so the default dynamic rendering model is used rather than Cache Components.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
