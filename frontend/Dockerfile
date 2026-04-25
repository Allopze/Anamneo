# Build stage
FROM node:20-alpine AS builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY frontend ./
COPY shared ../shared

# Set build-time environment variables
ARG NEXT_PUBLIC_API_URL=/api
ARG API_PROXY_TARGET=http://backend:5678/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV API_PROXY_TARGET=$API_PROXY_TARGET

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built assets with correct ownership (use built-in node user, uid 1000)
COPY --from=builder --chown=node:node /app/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder --chown=node:node /app/frontend/public ./frontend/public

USER node

EXPOSE 5555

ENV PORT=5555
ENV HOSTNAME="0.0.0.0"

CMD ["node", "frontend/server.js"]
