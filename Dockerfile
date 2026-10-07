FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd --system --gid 10001 linkedin && useradd --system --uid 10001 --gid linkedin --home-dir /nonexistent --shell /usr/sbin/nologin linkedin
COPY --from=build --chown=linkedin:linkedin /app/package.json /app/package-lock.json ./
COPY --from=build --chown=linkedin:linkedin /app/node_modules ./node_modules
COPY --from=build --chown=linkedin:linkedin /app/dist ./dist
RUN mkdir -p /data && chown linkedin:linkedin /data
USER 10001:10001
ENV LINKEDIN_MCP_QUEUE_PATH=/data/scheduled-posts.json
VOLUME ["/data"]
ENTRYPOINT ["node","dist/index.js"]
