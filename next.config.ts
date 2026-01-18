// Cache Buster: Make Record List Collapsible - Timestamp: 1737331200000
// Force Deploy Trigger: 2026-01-19 Make 'Record List' header collapsible with Chevron icon to match other sections
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
