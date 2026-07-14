# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @luxtime/api exec prisma generate
RUN pnpm --filter @luxtime/api build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./package.json
EXPOSE 3001
CMD ["node", "dist/main.js"]
