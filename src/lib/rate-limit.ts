// 輕量級限流（in-memory fixed-window）
//
// 適用場景：單一長駐 Node 進程（例如本 repo 嘅 Dockerfile：`npm start`）。
// 喺 serverless / 多實例環境，每個實例各有獨立記憶體，限流會較鬆 —
// 商用大規模部署應改用 Upstash Redis（見 README 部署備註）。
//
// 注意：`next/headers` 用動態 import，令純函數 rateLimit() 可以喺 node/vitest 獨立測試
// （唔會喺 module load 時靜態拉入 server-only 模組）。

type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();
const MAX_KEYS = 10_000; // 防止無上限增長

function sweep(now: number) {
  if (store.size <= MAX_KEYS) return;
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}

/**
 * @returns true = 允許，false = 已超出限額
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    sweep(now);
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

/** 由 proxy header 取得 client IP（用於限流 key）。 */
export async function clientIp(): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** 限流唔過就 throw 一個用戶睇得明嘅 Error。 */
export async function enforceRateLimit(
  action: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const ip = await clientIp();
  if (!rateLimit(`${action}:${ip}`, limit, windowMs)) {
    throw new Error("操作太頻繁，請稍後再試");
  }
}
