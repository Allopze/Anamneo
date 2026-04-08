# Backend Dockerfile
FROM node:20-alpine AS builder

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

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

# Create writable data directories
RUN mkdir -p uploads data

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app
USER nestjs

EXPOSE 5678

CMD ["npm", "run", "start:prod:migrate"]
