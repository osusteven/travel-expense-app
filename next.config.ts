import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
