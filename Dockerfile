# ── Stage 1: dependencies ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ── Stage 2: build ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client before build
RUN npx prisma generate

# next.config.ts sets output: 'standalone'
RUN npm run build

# ── Stage 3: production node_modules (complete tree for Prisma CLI migrate/seed)
FROM node:20-alpine AS prod-deps
WORKDIR /app

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# Run postinstall (prisma generate) so engines/binaries are present for migrate.
RUN npm ci --omit=dev

# ── Stage 4: runtime ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
# Standalone server listens on 3000 by default; Container Apps expects 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Copy standalone app output (server.js + traced assets)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static    ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public          ./public

# Overlay a full production node_modules so `prisma` / `tsx` and their
# transitive deps (e.g. effect, c12) are available for pre-deploy migrate/seed.
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Prisma schema, config, migrations, and files needed by migrate/seed
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/pg-adapter.ts ./src/lib/pg-adapter.ts

USER nextjs

EXPOSE 3000

# Default command: run the Next.js server
# The migrate Container Apps Job / Railway preDeploy overrides with:
#   npx prisma migrate deploy && npx prisma db seed
CMD ["node", "server.js"]
