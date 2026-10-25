FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm install

# Copy application source
COPY . .

# Build frontend production bundle
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built application and server code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server
COPY --from=builder /app/.env.example ./.env.example
COPY --from=builder /app/public ./public

# Create data directory for SQLite persistence
RUN mkdir -p /app/data/backups

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", "server.js"]
