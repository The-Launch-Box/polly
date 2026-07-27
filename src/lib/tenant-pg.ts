import type { PoolClient } from "pg";
import pg from "pg";
import { isSafeTenantSchemaName } from "./organizations";

const globalForPool = globalThis as unknown as {
  tenantPgPool: pg.Pool | undefined;
};

function sharedPool(): pg.Pool {
  if (!globalForPool.tenantPgPool) {
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

    globalForPool.tenantPgPool = new pg.Pool({
      connectionString,
      ssl: disableSsl ? undefined : { rejectUnauthorized: false },
      max: 10,
    });
  }
  return globalForPool.tenantPgPool;
}

/**
 * Run work inside a connection with search_path pinned to one tenant schema.
 * Use for physical per-org copies (Prisma always qualifies public."Form").
 */
export async function withTenantConnection<T>(
  schemaName: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (!isSafeTenantSchemaName(schemaName)) {
    throw new Error(`Invalid tenant schema name: ${schemaName}`);
  }

  const client = await sharedPool().connect();
  try {
    await client.query(`SET search_path TO "${schemaName}", public`);
    return await fn(client);
  } finally {
    try {
      await client.query("SET search_path TO public");
    } catch {
      // ignore reset errors on release
    }
    client.release();
  }
}

/** Upsert a form row (and related graph is handled by app via Prisma public + sync). */
export async function mirrorFormRowToTenant(
  schemaName: string,
  form: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    themeId: string;
    anonymous: boolean;
    organizationId: string;
    ownerUserId: string;
    createdAt: Date;
    updatedAt: Date;
  },
): Promise<void> {
  await withTenantConnection(schemaName, async (client) => {
    await client.query(
      `ALTER TABLE IF EXISTS "Form" ADD COLUMN IF NOT EXISTS "organizationId" TEXT`,
    );
    await client.query(
      `INSERT INTO "Form" (
        id, slug, title, description, "themeId", anonymous,
        "organizationId", "ownerUserId", "createdAt", "updatedAt"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        "themeId" = EXCLUDED."themeId",
        anonymous = EXCLUDED.anonymous,
        "organizationId" = EXCLUDED."organizationId",
        "ownerUserId" = EXCLUDED."ownerUserId",
        "updatedAt" = EXCLUDED."updatedAt"`,
      [
        form.id,
        form.slug,
        form.title,
        form.description,
        form.themeId,
        form.anonymous,
        form.organizationId,
        form.ownerUserId,
        form.createdAt,
        form.updatedAt,
      ],
    );
  });
}

/** Remove a form from the tenant schema (cascades related tenant rows). */
export async function deleteFormRowFromTenant(
  schemaName: string,
  formId: string,
): Promise<void> {
  await withTenantConnection(schemaName, async (client) => {
    await client.query(`DELETE FROM "Form" WHERE id = $1`, [formId]);
  });
}
