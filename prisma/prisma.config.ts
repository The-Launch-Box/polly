import { PrismaPg } from "@prisma/adapter-pg";
import { defineConfig } from "prisma/config";

export default defineConfig({
  datasourceUrl: process.env.DATABASE_URL,
  adapter: () => {
    return new PrismaPg({ connectionString: process.env.DATABASE_URL });
  },
});
