import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://voicepay:voicepay_dev_2026@localhost:5432/voicepay',
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}
