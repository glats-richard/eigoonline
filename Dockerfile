FROM node:20-slim AS deps
WORKDIR /app

# Install deps first for better caching
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Install production deps only (keep image smaller)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Copy only what we need to run
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/content ./src/content
# Webhook campaign endpoints call these scripts at runtime
COPY --from=builder /app/scripts/fetch-campaigns.mjs ./scripts/fetch-campaigns.mjs
COPY --from=builder /app/scripts/update-campaign.mjs ./scripts/update-campaign.mjs

EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]

