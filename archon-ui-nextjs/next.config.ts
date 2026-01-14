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

  // Configure allowed image domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui-avatars.com",
        pathname: "/api/**",
      },
    ],
  },

  // Proxy API requests to backend server to avoid CORS issues
  // DUAL URL STRATEGY:
  // - Browser requests: Use NEXT_PUBLIC_API_URL (localhost from host machine)
  // - Server-side proxy: Use API_SERVER_URL (Docker service name or localhost)
  //
  // Context detection:
  // - Inside Docker container: API_SERVER_URL = archon-server:8181
  // - Local dev (hybrid): API_SERVER_URL = localhost:8181 or uses NEXT_PUBLIC_API_URL
  async rewrites() {
    // Prioritize API_SERVER_URL for server-side proxy context
    // Falls back to NEXT_PUBLIC_API_URL for hybrid mode compatibility
    const backendUrl =
      process.env.API_SERVER_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8181";

    console.log("[Next.js Config] Proxy rewrite destination:", backendUrl);
    console.log("[Next.js Config] Environment:", {
      API_SERVER_URL: process.env.API_SERVER_URL,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
      NODE_ENV: process.env.NODE_ENV,
    });

    return [
      // Keep credentials endpoint in Next.js (don't proxy to backend)
      // This allows the Next.js API route at /api/credentials/[key] to handle requests
      {
        source: "/api/credentials/:path*",
        destination: "/api/credentials/:path*",
      },
      // Proxy all other API requests to backend server
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
