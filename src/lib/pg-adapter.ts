import { PrismaPg } from "@prisma/adapter-pg";

/** Build a PrismaPg adapter that works for local Docker and Railway Postgres. */
export function createPrismaPgAdapter() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const isLocal =
    /localhost|127\.0\.0\.1/.test(connectionString) ||
    connectionString.includes("@postgres:"); // docker-compose service host

  return new PrismaPg({
    connectionString,
    // Hosted Postgres (Railway public proxy, etc.) often needs TLS with a
    // non-standard CA; node-pg rejects those unless this is set.
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });
}
