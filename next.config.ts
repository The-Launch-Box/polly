import type { NextConfig } from "next";

// Normal production build + `next start` in Docker (see Dockerfile / railway.toml).
// Avoid `output: "standalone"` — standalone `node server.js` was not seeing Railway
// AUTH_* env at runtime (Entra client_id=undefined).
const nextConfig: NextConfig = {};

export default nextConfig;
