// Cache Buster: Fix List Collapse & Fonts - Timestamp: 1737330000000
// Force Deploy Trigger: 2026-01-19 Rewrite Date Header as Button, Force Chevron Icon, Unify Input Fonts
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
