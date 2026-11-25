#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MODEL_NAME="${OLLAMA_MODEL:-qwen2.5:3b}"
OLLAMA_HOST_PORT="${OLLAMA_HOST_PORT:-11434}"

echo "=== VoxLead AI: Starting Ollama Docker Service ==="

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker CLI not found. Please install Docker Desktop for macOS."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running. Please start Docker Desktop and retry."
  exit 1
fi

cd "$PROJECT_ROOT"
OLLAMA_HOST_PORT="$OLLAMA_HOST_PORT" docker compose up -d ollama

echo "Waiting for Ollama API at http://localhost:$OLLAMA_HOST_PORT ..."
for i in {1..30}; do
  if curl -sf "http://localhost:$OLLAMA_HOST_PORT/api/tags" >/dev/null 2>&1; then
    echo "Ollama API is healthy."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Ollama API did not become healthy within 30 seconds."
    exit 1
  fi
  sleep 1
done

if docker exec voxlead-ollama ollama list | grep -qE "^${MODEL_NAME}[[:space:]]"; then
  echo "Model '$MODEL_NAME' is installed and ready in persistent volume."
else
  echo ""
  echo "WARNING: Model '$MODEL_NAME' is not yet installed in the Docker volume."
  echo "Run the following explicit command once to download it:"
  echo "  docker exec -it voxlead-ollama ollama pull $MODEL_NAME"
  echo ""
fi
