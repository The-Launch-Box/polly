import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";

/**
 * Build a PrismaPg adapter that works for local Docker and Railway Postgres.
 *
 * Prisma 7 + @prisma/adapter-pg can hang or fail when only `connectionString`
 * is passed to SSL-backed hosts. Explicit pool fields + ssl avoids that:
 * https://github.com/prisma/prisma/issues/29252
 */
export function createPrismaPgAdapter() {
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

  if (!disableSsl) {
    // Railway (and many hosted PG) use TLS with a cert Node does not trust.
    config.ssl = { rejectUnauthorized: false };
  }

  return new PrismaPg(config);
}
