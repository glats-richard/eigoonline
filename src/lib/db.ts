import { Pool, types } from "pg";

/**
 * pg type parsers
 * - 1700: NUMERIC
 * - 20:   INT8 / BIGINT (e.g. COUNT(*))
 */
types.setTypeParser(1700, (val) => (val === null ? null : Number(val)));
types.setTypeParser(20, (val) => (val === null ? null : Number(val)));

function readDatabaseUrl() {
  // In Astro SSR, env vars are available at runtime via process.env.
  // During dev/build, import.meta.env can also exist; prefer runtime env.
  return process.env.DATABASE_URL ?? (import.meta as any).env?.DATABASE_URL ?? undefined;
}

export const dbUrl = readDatabaseUrl();

export const dbEnvError: string | null = !dbUrl ? "Missing DATABASE_URL env var" : null;

declare global {
  // eslint-disable-next-line no-var
  var __EIGOONLINE_PG_POOL__: Pool | undefined;
}

export const pool: Pool | null = (() => {
  if (!dbUrl) return null;
  if (globalThis.__EIGOONLINE_PG_POOL__) return globalThis.__EIGOONLINE_PG_POOL__;

  // Railway internal URLs usually don't need SSL. If you use a public proxy URL,
  // set PGSSLMODE=require (or supply ssl options) in the environment.
  const ssl =
    process.env.PGSSLMODE === "require"
      ? { rejectUnauthorized: false }
      : undefined;

  const p = new Pool({
    connectionString: dbUrl,
    ssl,
    max: 5,
  });

  globalThis.__EIGOONLINE_PG_POOL__ = p;
  return p;
})();

export async function query<T extends Record<string, any> = Record<string, any>>(
  text: string,
  params: any[] = [],
) {
  if (!pool) throw new Error(dbEnvError ?? "Postgres pool is not initialized");
  return pool.query<T>(text, params);
}

