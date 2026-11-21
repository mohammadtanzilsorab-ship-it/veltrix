# VELTRIX Tier 1 collector — long-running Bun + socket.io service

FROM oven/bun:1.1-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.1-slim
WORKDIR /app
ENV NODE_ENV=production
# Render provides PORT automatically
ENV PORT=3001

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Persist the SQLite database to a mounted volume
VOLUME ["/app/data"]
ENV DB_PATH=/app/data/collector.db

EXPOSE 3001
# Use the start script (already in package.json)
CMD ["bun", "run", "start"]
