# Backend PetWalk — multi-stage build.
# Build dari ROOT repo (butuh workspace pnpm):
#   docker build -f backend/Dockerfile -t petwalk-backend .

FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --filter @petwalk/backend...

COPY backend backend
RUN cd backend && pnpm prisma generate && pnpm build

FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9.12.1 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --prod --filter @petwalk/backend...

COPY backend/prisma backend/prisma
RUN cd backend && pnpm prisma generate

COPY --from=builder /app/backend/dist backend/dist

WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/main"]
