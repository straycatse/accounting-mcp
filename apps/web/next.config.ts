import type { NextConfig } from "next";

// Server-side proxy target for the API. In Railway this is the private-network
// URL of the api service; locally the api dev server. All browser-facing API
// traffic goes through these rewrites so the better-auth session cookie lives
// on THIS origin (Railway's *.up.railway.app is on the Public Suffix List, so
// two services can never share cookies directly).
const apiUrl =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      { source: "/connect/:path*", destination: `${apiUrl}/connect/:path*` },
      { source: "/trpc/:path*", destination: `${apiUrl}/trpc/:path*` },
    ];
  },
};

export default nextConfig;
