#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
packages/db/node_modules/.bin/prisma migrate deploy --schema=packages/db/prisma/schema.prisma

echo "[entrypoint] Starting Next.js..."
cd /app/apps/web
exec node_modules/.bin/next start --port "$PORT" --hostname "$HOSTNAME"
