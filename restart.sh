#!/bin/bash

# Script to rebuild and restart the MSAnalyzer Docker containers
# This ensures that any code changes (like the new resizable panels) are applied.

# Determine container compose tool
COMPOSE_CMD="docker compose"
if command -v podman-compose &> /dev/null && ! command -v docker &> /dev/null; then
    COMPOSE_CMD="podman-compose"
fi

echo "Stopping and rebuilding MSAnalyzer containers using $COMPOSE_CMD..."

# Rebuild and restart in detached mode
$COMPOSE_CMD up -d --build

echo "MSAnalyzer has been restarted."
echo "Frontend should be available at http://localhost:8080"
