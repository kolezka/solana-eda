# ---- Base ----
FROM node:18-alpine AS base
RUN corepack enable && corepack prepare pnpm@8.15.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY workers/trading-bot/package.json ./workers/trading-bot/package.json
COPY workers/liquidity-monitor/package.json ./workers/liquidity-monitor/package.json
COPY workers/burn-detector/package.json ./workers/burn-detector/package.json
COPY workers/price-aggregator/package.json ./workers/price-aggregator/package.json
COPY workers/market-detector/package.json ./workers/market-detector/package.json
COPY workers/rpc-sidecar/package.json ./workers/rpc-sidecar/package.json
COPY packages/rabbitmq/package.json ./packages/rabbitmq/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/events/package.json ./packages/events/package.json
COPY packages/solana-client/package.json ./packages/solana-client/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/error-handling/package.json ./packages/error-handling/package.json
COPY packages/monitoring/package.json ./packages/monitoring/package.json
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM deps AS build
COPY . .
RUN pnpm run db:generate
RUN pnpm run build

# ---- API ----
FROM base AS api
COPY --from=build /app /app
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

# ---- Frontend ----
FROM base AS frontend
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "frontend", "start"]

# ---- Worker ----
FROM base AS worker
ARG WORKER_NAME
COPY --from=build /app /app
CMD ["sh", "-c", "node workers/${WORKER_NAME}/dist/index.js"]

# ---- RPC Sidecar ----
FROM base AS rpc-sidecar
COPY --from=build /app /app
EXPOSE 3002
CMD ["node", "workers/rpc-sidecar/dist/index.js"]
