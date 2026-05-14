#!/bin/bash

# Script to rebuild and restart the MSAnalyzer Docker containers
# This ensures that any code changes (like the new resizable panels) are applied.

echo "Stopping and rebuilding MSAnalyzer containers..."

# Rebuild and restart in detached mode
docker compose up -d --build

echo "MSAnalyzer has been restarted."
echo "Frontend should be available at http://localhost:8080"
