import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDatabasePool } from './pool';

async function migrate(): Promise<void> {
  const pool = createDatabasePool();
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(706621953)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const path = join(process.cwd(), 'migrations');
    const migrations = (await readdir(path)).filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
    for (const name of migrations) {
      const exists = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
      if (exists.rowCount) continue;
      const sql = await readFile(join(path, name), 'utf8');
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
    }
    console.info('Database schema is up to date');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error: unknown) => {
  console.error('Migration failed', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
