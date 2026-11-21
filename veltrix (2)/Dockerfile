# VELTRIX Next.js app — Tier 2 SaaS
# Multi-stage build: install deps → build → run standalone server

FROM oven/bun:1.1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client before build
RUN bun run db:generate
# Build Next.js (produces .next/standalone)
RUN bun run build

FROM oven/bun:1.1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy standalone build + static assets + public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Prisma needs the schema to generate the client at runtime if needed
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000
CMD ["bun", ".next/standalone/server.js"]
