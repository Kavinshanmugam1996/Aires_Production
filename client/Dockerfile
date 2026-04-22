# ==============================================================
# AiresTestEnv - Frontend Dockerfile
# Node 20 LTS Alpine (build) -> nginx 1.27 Alpine (serve)
# Multi-stage | Non-root nginx | Gzip | CSP | SPA routing
#
# To upgrade Node:  --build-arg NODE_VERSION=22-alpine3.21
# To upgrade nginx: --build-arg NGINX_VERSION=1.29-alpine3.21
# ==============================================================

ARG NODE_VERSION=20-alpine3.21
ARG NGINX_VERSION=1.27-alpine3.21

# Stage 1: Build the Vite/React app
FROM node:${NODE_VERSION} AS build

WORKDIR /app

# Layer cache: install deps first (re-runs only on package.json change)
COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .

# Build-time env vars - Vite bakes VITE_* into the JS bundle.
# Pass via --build-arg in CI/CD. Do NOT pass secrets here.
# Defaults point to the real AiresTestEnv Cognito pool.
ARG VITE_API_URL
ARG VITE_STRIPE_PUBLISHABLE_KEY
ARG VITE_COGNITO_REGION=ca-central-1
ARG VITE_COGNITO_USER_POOL_ID=ca-central-1_84cnd8m6x
ARG VITE_COGNITO_CLIENT_ID=7rl33f6cq2bjpb8adsh1kq40b7
ARG VITE_COGNITO_DOMAIN=ca-central-184cnd8m6x.auth.ca-central-1.amazoncognito.com

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY
ENV VITE_COGNITO_REGION=$VITE_COGNITO_REGION
ENV VITE_COGNITO_USER_POOL_ID=$VITE_COGNITO_USER_POOL_ID
ENV VITE_COGNITO_CLIENT_ID=$VITE_COGNITO_CLIENT_ID
ENV VITE_COGNITO_DOMAIN=$VITE_COGNITO_DOMAIN

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:${NGINX_VERSION} AS production

RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Non-root nginx
RUN chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chown -R nginx:nginx /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
