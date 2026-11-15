import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

async function migrate(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const name = '001_initial.sql';
    const exists = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    if (exists.rowCount === 0) {
      const sql = await readFile(join(process.cwd(), 'migrations', name), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        console.info(`Applied migration ${name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } else {
      console.info('Database schema is up to date');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error: unknown) => {
  console.error('Migration failed', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
