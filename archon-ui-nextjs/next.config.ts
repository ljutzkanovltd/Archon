import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Proxy API requests to backend server to avoid CORS issues in local dev
  // This allows running Next.js locally (port 3738) while backend runs in Docker (port 8181)
  async rewrites() {
    // Only proxy in development mode - in Docker, services use internal network
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8181";

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/health",
        destination: `${backendUrl}/health`,
      },
    ];
  },
};

export default nextConfig;
