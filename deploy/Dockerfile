# Flowlary AI Gateway — production container
FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/

RUN npm ci --workspace=@flowlary/backend --include-workspace-root=false \
  && npm ci --workspace=@flowlary/shared --include-workspace-root=false

COPY packages/shared packages/shared
COPY backend backend

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
ENV FLOWLARY_DATA_PATH=/data/flowlary-store.json

EXPOSE 8787

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8787/health || exit 1

CMD ["node", "--import", "tsx", "backend/src/index.ts"]
