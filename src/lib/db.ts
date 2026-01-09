import { Pool } from 'pg';

let pool: Pool | null = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL not found');
}
pool = new Pool({
  connectionString,
  ssl: false,
});
  }
  return pool;
}

export async function query(text: string, params?: any[]) {
  const client = getPool();
  return client.query(text, params);
}

export async function getClient() {
  return getPool().connect();
}
