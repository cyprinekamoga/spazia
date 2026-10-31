import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export – served by Netlify from /out.
  output: "export",
  images: { unoptimized: true },
  experimental: {
    // Needed because the app has two root layouts (sv + en).
    globalNotFound: true,
  },
};

export default nextConfig;
