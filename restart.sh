#!/bin/bash

# Script to rebuild and restart the MSAnalyzer Docker containers
# This ensures that any code changes (like the new resizable panels) are applied.

# Workaround for corporate proxies generating certificates with negative serial numbers.
# This instructs Go-based CLIs (like podman, podman-compose, or docker-compose) to accept them.
export GODEBUG=x509negativeserial=1

# Determine container compose tool
COMPOSE_CMD="docker compose"
if command -v podman-compose > /dev/null 2>&1 && ! command -v docker > /dev/null 2>&1; then
    COMPOSE_CMD="podman-compose"
fi

echo "Stopping and rebuilding MSAnalyzer containers using $COMPOSE_CMD..."

# Rebuild and restart in detached mode
$COMPOSE_CMD up -d --build

echo "MSAnalyzer has been restarted."
echo "Frontend should be available at http://localhost:8080"
