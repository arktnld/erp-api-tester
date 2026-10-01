FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

# ---- deps ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --prod=false

# ---- builder ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN pnpm --filter db generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

# ---- runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/web ./apps/web
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/data && \
    chown -R nextjs:nodejs /app/data /app/apps/web/.next

USER nextjs
EXPOSE 9000
ENV PORT=9000
ENV HOSTNAME=0.0.0.0

# sh explícito: não depende do bit de execução do arquivo
ENTRYPOINT ["sh", "/app/apps/web/docker-entrypoint.sh"]
