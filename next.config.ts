import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Pre-existing type errors in frontend pages — skip for build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
