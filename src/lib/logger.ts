// 簡單 logger：production 唔好喺 client console 嘈，dev 先輸出。
// P3 可以喺呢度接 Sentry / monitoring（commercial-grade error tracking）。
const isDev = process.env.NODE_ENV !== "production";

export const logger = {
  error(...args: unknown[]) {
    if (isDev) console.error(...args);
    // TODO(P3): forward to Sentry / monitoring in production
  },
  warn(...args: unknown[]) {
    if (isDev) console.warn(...args);
  },
  info(...args: unknown[]) {
    if (isDev) console.info(...args);
  },
};
