#!/bin/sh
set -eu

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting Next.js..."
exec npx next start --hostname 0.0.0.0
