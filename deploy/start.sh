#!/bin/sh
# Start the TEE guard in the background, then the guardian service in the
# foreground (so the container's process 1 is the tracked service).
set -e

cd /app

# TEE guard on :8080 (the service calls it via TEE_URL=http://127.0.0.1:8080)
./praesidio-tee &
TEE_PID=$!

# Guardian service on $PORT (default 9000)
node service.mjs

# If the service exits, bring the TEE down too.
kill "$TEE_PID" 2>/dev/null || true
