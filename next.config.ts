// UI Fix: Sync Header Styles & Fix Date Toggle - 1737332400000
// Cache Buster: Clone Record List header style from top sections and fix date collapse logic
import type { NextConfig } from "next";
// @ts-ignore - next-pwa doesn't have TypeScript definitions
import withPWA from 'next-pwa';

const nextConfig: NextConfig = {
  turbopack: {}, // Empty turbopack config to avoid webpack conflict
};

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
})(nextConfig);
