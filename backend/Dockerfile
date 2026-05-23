# Backend Dockerfile
FROM node:20-alpine AS builder

# Prisma engine download needs openssl to detect the correct target
RUN apk add --no-cache openssl

WORKDIR /app/backend
ENV DATABASE_URL=postgresql://anamneo_owner:anamneo_owner@localhost:5432/anamneo?schema=public
ENV MIGRATION_DATABASE_URL=postgresql://anamneo_owner:anamneo_owner@localhost:5432/anamneo?schema=public

# Install dependencies
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Build application
COPY backend ./
COPY shared ../shared
RUN npm run build

# Production image
FROM node:20-alpine AS production

# Prisma requires openssl on Alpine; operational scripts need PostgreSQL client tools.
RUN apk add --no-cache openssl postgresql16-client

WORKDIR /app

# Install only runtime dependencies while keeping Prisma CLI available for explicit migrate steps
COPY --from=builder /app/backend/package*.json ./
COPY --from=builder /app/backend/prisma ./prisma
RUN npm ci --omit=dev

# Copy built artifacts with correct ownership (use built-in node user, uid 1000)
COPY --from=builder --chown=node:node /app/backend/dist ./dist
COPY --from=builder --chown=node:node /app/backend/scripts ./scripts
COPY --from=builder --chown=node:node /app/backend/src/common/assets ./dist/backend/src/common/assets

# Create writable data directories
RUN mkdir -p uploads data data/backups && \
    chown -R node:node uploads data

USER node

EXPOSE 5679

CMD ["node", "dist/backend/src/main.js"]
