#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_DIR="$PROJECT_ROOT/.pids"

echo "=== Stopping VoxLead AI Application Services ==="

for svc in backend frontend; do
  PID_FILE="$PID_DIR/${svc}.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" >/dev/null 2>&1; then
      kill "$PID" >/dev/null 2>&1 || true
      echo "Stopped $svc (PID $PID)."
    fi
    rm -f "$PID_FILE"
  fi
done

"$SCRIPT_DIR/stop_ollama.sh"
echo "All services stopped. SQLite database and Ollama Docker volume were preserved."
