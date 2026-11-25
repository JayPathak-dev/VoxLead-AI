#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== VoxLead AI: Stopping Ollama Docker Container (preserving persistent volume) ==="
cd "$PROJECT_ROOT"
docker compose stop ollama
echo "Ollama container stopped. Model weights in volume 'voxlead_ollama_data' are preserved."
