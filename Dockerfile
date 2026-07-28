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

RUN npm run build

# ── Stage 3: production node_modules (complete tree for Prisma CLI migrate/seed
# and for `next start` — same runtime shape as the working Nixpacks deploy)
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
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV ATTACHMENTS_DIR=/tmp/polly-uploads

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Full Next build + deps so we use `next start` (not standalone `node server.js`).
# Standalone was baking AUTH_* as undefined at build time; next start reads Railway
# runtime env the same way the working Nixpacks deploy does.
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Prisma schema, config, migrations, and files needed by migrate/seed
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated
COPY --from=builder --chown=nextjs:nodejs /app/src/lib/pg-adapter.ts ./src/lib/pg-adapter.ts

RUN mkdir -p /tmp/polly-uploads /app/.uploads /app/.next/cache \
  && chown -R nextjs:nodejs /app /tmp/polly-uploads

USER nextjs

EXPOSE 3000

# Match the working deploy: next start (Railway overrides with startCommand)
CMD ["npx", "next", "start", "--hostname", "0.0.0.0"]
