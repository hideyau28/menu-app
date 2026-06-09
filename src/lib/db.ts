import { Pool, type PoolConfig } from "pg";

let pool: Pool | null = null;

/**
 * TLS/SSL 設定，由環境變數 DATABASE_SSL 控制（預設維持「唔用 TLS」以兼容自架 / 本地 Postgres）：
 *   - 未設定 / "disable" → 唔用 TLS（= 本 repo 目前嘅行為）
 *   - "require"          → 用 TLS 並驗證憑證（最安全）
 *   - "no-verify"        → 用 TLS 但唔驗證憑證（雲端 pooler 用自簽 CA 時用呢個）
 *
 * ⚠️ 商用級建議：將 DB 搬去支援 TLS 嘅 managed Postgres（Supabase / Neon / RDS），
 *    再設 DATABASE_SSL=require，避免帳目同密碼明文過公網。
 *    （現時個 DB 唔支援 SSL，所以預設保持唔用 TLS，唔會整爛現有連線。）
 */
function resolveSsl(): PoolConfig["ssl"] {
  switch (process.env.DATABASE_SSL?.toLowerCase()) {
    case "require":
      return { rejectUnauthorized: true };
    case "no-verify":
      return { rejectUnauthorized: false };
    default:
      return false;
  }
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL not found");
    }

    pool = new Pool({
      connectionString,
      ssl: resolveSsl(),
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    // 唔好令背景 idle client 錯誤 crash 成個 process
    pool.on("error", (err) => {
      console.error("[db] idle client error:", err.message);
    });
  }
  return pool;
}

export async function query(text: string, params?: unknown[]) {
  return getPool().query(text, params);
}

export async function getClient() {
  return getPool().connect();
}
