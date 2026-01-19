// Feat: Multi-date expansion, unified chevron icons, improved error UI - 1737334800000
// Enable multi-date expansion, update error UI to Refresh style, and unify header icons
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
