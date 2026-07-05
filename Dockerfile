FROM node:20-alpine AS base
WORKDIR /app

# Dependencies layer
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Final image
FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

EXPOSE 3001
CMD ["node", "src/server.js"]
