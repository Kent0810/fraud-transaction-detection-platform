FROM node:22-slim AS build

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY app.json tsconfig.json ./
COPY assets/ ./assets/
COPY src/ ./src/

ARG EXPO_PUBLIC_API_URL=http://localhost:8080
ARG EXPO_PUBLIC_CARD_ID=180048185037117
# 180048185037117 or
# 4653879239169997

ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL \
    EXPO_PUBLIC_CARD_ID=$EXPO_PUBLIC_CARD_ID

RUN npx expo export --platform web --output-dir dist

FROM nginx:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /build/dist /usr/share/nginx/html
