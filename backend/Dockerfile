# Backend Dockerfile
FROM node:20-alpine AS builder

# Prisma engine download needs openssl to detect the correct target
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Build application
COPY . .
RUN npm run build

# Production image
FROM node:20-alpine AS production

# Prisma requires openssl on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy built artifacts with correct ownership (use built-in node user, uid 1000)
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/scripts ./scripts

# Create writable data directories
RUN mkdir -p uploads data data/backups && \
    chown -R node:node uploads data

USER node

EXPOSE 5678

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
