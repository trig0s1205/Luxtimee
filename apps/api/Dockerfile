# Build multi-stage de la API. Contexto: raíz del monorepo.
# Migraciones Prisma: NO se ejecutan al arrancar. Comando validado en la imagen:
#   docker compose run --rm --no-deps --entrypoint sh api -c \
#     './node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma'
# (WORKDIR de la imagen = /app/apps/api; el symlink .bin apunta al CLI de pnpm)

FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
# El postinstall de la API corre `prisma generate`: el schema debe existir antes del install.
COPY apps/api/prisma ./apps/api/prisma
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @luxtime/shared build \
  && pnpm --filter @luxtime/api exec prisma generate \
  && pnpm --filter @luxtime/api build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NODE_OPTIONS=--max-old-space-size=1024 \
    PORT=3000 \
    HOST=0.0.0.0

RUN apk add --no-cache openssl \
  && addgroup -S nodejs \
  && adduser -S nestjs -G nodejs \
  && mkdir -p /app/apps/api/uploads/watches/videos \
  && chown -R nestjs:nodejs /app/apps/api/uploads

COPY --from=builder --chown=nestjs:nodejs /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared ./packages/shared
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules

USER nestjs
WORKDIR /app/apps/api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
