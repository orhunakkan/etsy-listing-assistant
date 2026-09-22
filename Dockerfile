# ---- build stage -------------------------------------------------------
# Install all deps and compile both workspaces.
FROM node:25-alpine AS builder
WORKDIR /app

# Copy workspace manifests first so Docker can cache the install layer.
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci

# Copy source files and shared config.
COPY tsconfig.base.json ./
COPY client ./client
COPY server ./server

# Build client (Vite → client/dist) and server (tsc → server/dist).
RUN npm run build

# ---- runtime stage -----------------------------------------------------
# Lean production image: only production deps + compiled artefacts.
FROM node:25-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies only.
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci --omit=dev

# Bring in the build artefacts from the builder stage.
COPY --from=builder --chown=node:node /app/client/dist ./client/dist
COPY --from=builder --chown=node:node /app/server/dist ./server/dist

USER node

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/ready').then(r=>r.ok||process.exit(1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
