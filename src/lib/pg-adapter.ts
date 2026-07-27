import type { PoolConfig } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Build a PrismaPg adapter that works for local Docker and hosted Postgres.
 *
 * Optional `searchPath` sets Postgres search_path (used when mirroring rows
 * into per-org tenant schemas via raw SQL). Prisma model queries always use
 * the `public` schema from DATABASE_URL.
 */
export function createPrismaPgAdapter(options?: { searchPath?: string }) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const url = new URL(connectionString);
  const hostname = url.hostname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "postgres";

  const sslMode = (url.searchParams.get("sslmode") ?? "").toLowerCase();
  const disableSsl = isLocal || sslMode === "disable";

  const config: PoolConfig = {
    host: hostname,
    port: url.port ? Number(url.port) : 5432,
    database: decodeURIComponent(url.pathname.replace(/^\//, "")) || undefined,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    connectionTimeoutMillis: 10_000,
  };

  if (options?.searchPath) {
    // Keep public visible for enums / extensions; Prisma model queries use
    // the schema set above.
    config.options = `-c search_path=${options.searchPath},public`;
  }

  if (!disableSsl) {
    config.ssl = { rejectUnauthorized: false };
  }

  return new PrismaPg(config);
}
