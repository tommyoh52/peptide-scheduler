# Fly.io Dockerfile for peptide-app
# Two-stage build keeps the final image small.
FROM node:20-slim AS builder

# Install build deps for better-sqlite3 (native module)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# --- runtime image ---
FROM node:20-slim AS runtime

# Runtime libs for better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data

# Copy built app + node_modules (includes compiled native modules)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Fly's persistent volume gets mounted at /data
RUN mkdir -p /data

EXPOSE 8080

CMD ["node", "dist/index.cjs"]
