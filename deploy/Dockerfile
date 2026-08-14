# PRAESIDIO guardian — single-container deploy (TEE guard + relay service).
# Builds the Go TEE binary, installs the Node backend, and runs both.
#
#   docker build -f deploy/Dockerfile -t praesidio .
#   docker run -p 9000:9000 --env-file /etc/praesidio/env praesidio

# ---- Stage 1: build the TEE guard ----
FROM golang:1.26 AS tee-build
WORKDIR /src
COPY tee/go/go.mod tee/go/go.sum ./
RUN go mod download
COPY tee/go/ ./
RUN CGO_ENABLED=0 go build -o /praesidio-tee ./cmd/main.go

# ---- Stage 2: runtime (Node + TEE binary) ----
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=tee-build /praesidio-tee /app/praesidio-tee
COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY backend/ ./
COPY deploy/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Render and friends expose the service on $PORT; /health listens there.
EXPOSE 9000
CMD ["/app/start.sh"]
