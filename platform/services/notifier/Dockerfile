# Built from the platform directory (see docker-compose.yml) so the shared @platform/db package is in the context.
FROM node:22-slim AS build

WORKDIR /build/packages/db
COPY packages/db/package.json packages/db/package-lock.json ./
RUN npm ci
COPY packages/db/tsconfig.json packages/db/prisma.config.ts ./
COPY packages/db/prisma/ ./prisma/
COPY packages/db/src/ ./src/
RUN npm run build && npm prune --omit=dev

WORKDIR /build/services/notifier
COPY services/notifier/package.json services/notifier/package-lock.json ./

# install exactly what package-lock.json pins
RUN npm ci

COPY services/notifier/tsconfig.json services/notifier/nest-cli.json ./
COPY services/notifier/src/ ./src/

RUN npm run build && npm prune --omit=dev

FROM node:22-slim

ENV NODE_ENV=production
COPY --from=build /build/packages/db/package.json /app/packages/db/
COPY --from=build /build/packages/db/node_modules /app/packages/db/node_modules
COPY --from=build /build/packages/db/dist /app/packages/db/dist

WORKDIR /app/services/notifier
COPY --from=build /build/services/notifier/node_modules ./node_modules
COPY --from=build /build/services/notifier/dist ./dist
COPY services/notifier/package.json ./

# Exec form: node is PID 1 and gets SIGTERM, so Nest's shutdown hooks close the Kafka and Postgres clients.
ENTRYPOINT ["node", "dist/main.js"]
