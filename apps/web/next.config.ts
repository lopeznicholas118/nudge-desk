import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@nudge/core", "@nudge/db"],
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
