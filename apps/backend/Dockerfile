# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/

# Install all workspace deps (backend only, skip others)
RUN npm ci --workspace=apps/backend

# Copy source
COPY apps/backend/ ./apps/backend/
# Copy any shared packages the backend imports
COPY packages/ ./packages/

WORKDIR /app/apps/backend

# Generate Prisma client and build NestJS
RUN npx prisma generate \
  && npm run build

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/

# Production-only install (no devDependencies)
RUN npm ci --workspace=apps/backend --omit=dev

# Copy compiled output + prisma schema (needed at runtime for migrations)
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
# Copy generated Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/apps/backend

EXPOSE 3000

# Run pending migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
