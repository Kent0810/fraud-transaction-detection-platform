FROM node:22-slim AS build

WORKDIR /build
COPY package.json package-lock.json ./

# install exactly what package-lock.json pins
RUN npm ci

COPY tsconfig.json nest-cli.json ./
COPY src/ ./src/

RUN npm run build && npm prune --omit=dev

FROM node:22-slim

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/dist ./dist
COPY package.json ./

# Exec form: node is PID 1 and gets SIGTERM, so Nest's shutdown hooks close the Cassandra client.
ENTRYPOINT ["node", "dist/main.js"]
