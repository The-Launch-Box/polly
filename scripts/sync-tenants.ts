import "dotenv/config";
import { syncOrganizationsAndSchemas } from "../src/lib/tenant-schema";

async function main() {
  const orgs = await syncOrganizationsAndSchemas();
  console.log(`Synced ${orgs.length} organizations and tenant schemas:`);
  for (const org of orgs) {
    console.log(`  - ${org.name} (${org.emailDomain}) → ${org.schemaName}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
