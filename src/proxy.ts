import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Next.js 16 `proxy` runs on the Node.js runtime (not Edge).
 * Still use Edge-safe auth.config — do not import src/auth.ts (Prisma) here.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
