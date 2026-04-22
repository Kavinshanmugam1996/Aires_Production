# ==============================================================
# AiresTestEnv - Backend Dockerfile
# Node 20 LTS Alpine | Multi-stage | Non-root | Tini | Health check
#
# To upgrade Node: change NODE_VERSION below or pass --build-arg
#   docker build --build-arg NODE_VERSION=22-alpine3.21 .
# ==============================================================

ARG NODE_VERSION=20-alpine3.21

# Stage 1: Install production dependencies
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Lean production image
FROM node:${NODE_VERSION} AS production

# tini = proper PID 1, forwards SIGTERM so ECS can drain gracefully
# curl = used by HEALTHCHECK
RUN apk add --no-cache tini curl

# Dedicated non-root user - never run as root in production
RUN addgroup -S airesgroup && adduser -S airesuser -G airesgroup

WORKDIR /app

# Pull in node_modules from deps stage (no devDependencies)
COPY --from=deps --chown=airesuser:airesgroup /app/node_modules ./node_modules

# Copy application source (everything not in .dockerignore)
COPY --chown=airesuser:airesgroup . .

# Writable data dir for local CSV fallback
RUN mkdir -p data/submissions && chown -R airesuser:airesgroup data

USER airesuser

# Only non-secret values baked in.
# Secrets are injected at runtime:
#   PRODUCTION : ECS Task Secrets via AWS Secrets Manager
#   LOCAL DEV  : .env file loaded by dotenv / docker-compose
ENV NODE_ENV=production
ENV PORT=8080
ENV AWS_DEFAULT_REGION=ca-central-1

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:8080/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
