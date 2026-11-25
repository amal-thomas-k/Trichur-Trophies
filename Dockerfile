FROM node:24.22.3-bookworm-slim
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile && pnpm exec playwright install --with-deps chromium
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app/data /ms-playwright
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
