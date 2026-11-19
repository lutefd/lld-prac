FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM golang:1.26-bookworm AS go-tools
RUN go install golang.org/x/tools/gopls@v0.22.0

FROM node:24-bookworm-slim AS backend
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 docker.io ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=go-tools /usr/local/go /usr/local/go
COPY --from=go-tools /go/bin/gopls /usr/local/bin/gopls
ENV PATH="/usr/local/go/bin:${PATH}" \
    NODE_ENV=production \
    PRACTICE_HOST=0.0.0.0
WORKDIR /app
COPY --from=build /app/package.json ./
# Language servers are dev dependencies and are needed at runtime.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
EXPOSE 3001
CMD ["node", "server/index.ts"]

FROM nginx:stable-alpine AS frontend
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
