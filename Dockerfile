FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

# Token store and queue persist here (see src/tokenStore.ts, src/queue.ts,
# which write under the OS home directory) — mount a volume at /data.
ENV HOME=/data
RUN mkdir -p /data/.linkedin-mcp && chown -R node:node /data
USER node

ENV MCP_TRANSPORT=http
EXPOSE 3000
CMD ["node", "dist/index.js"]
