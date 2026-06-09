import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // 鎖定 workspace root，避免被上層 stray lockfile（~/pnpm-lock.yaml）誤判
    root: process.cwd(),
  },
};

// PWA：暫用 manifest-only（「加到主畫面」靠 public/manifest.json 已經 work）。
// 真・offline service worker 留待：(1) 有 sync 基建，(2) serwist + Turbopack 穩定 後先加，
// 避免 ship 一個驗證唔到、可能 serve 過期內容嘅 SW。
export default nextConfig;
