#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_DIR="$PROJECT_ROOT/.pids"
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$PID_DIR" "$LOG_DIR"

echo "=========================================="
echo "  Starting VoxLead AI (Local Stack)"
echo "=========================================="

# 1 & 2. Check Docker Desktop & start Ollama container
"$SCRIPT_DIR/start_ollama.sh"

# 3. Verify Python virtual environment
VENV_PYTHON="$PROJECT_ROOT/backend/.venv/bin/python"
if [ ! -x "$VENV_PYTHON" ]; then
  echo "ERROR: Python virtual environment not found at backend/.venv"
  echo "Create it with:"
  echo "  python3.11 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt"
  exit 1
fi

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
OLLAMA_HOST_PORT="${OLLAMA_HOST_PORT:-11434}"

# 4. Start FastAPI Backend
echo "Starting FastAPI backend on http://localhost:$BACKEND_PORT ..."
cd "$PROJECT_ROOT/backend"
"$VENV_PYTHON" -m uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" > "$LOG_DIR/backend.log" 2>&1 &
echo $! > "$PID_DIR/backend.pid"

# 5. Start React Frontend
echo "Starting React frontend on http://localhost:$FRONTEND_PORT ..."
cd "$PROJECT_ROOT/frontend"
if [ ! -d "node_modules" ]; then
  echo "Installing frontend dependencies..."
  npm install
fi
npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT" > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$PID_DIR/frontend.pid"

echo ""
echo "VoxLead AI services launched!"
echo "  Frontend:          http://localhost:$FRONTEND_PORT"
echo "  Backend API:       http://localhost:$BACKEND_PORT"
echo "  Swagger API Docs:  http://localhost:$BACKEND_PORT/docs"
echo "  Ollama API:        http://localhost:$OLLAMA_HOST_PORT"
echo ""
echo "Logs: $LOG_DIR/backend.log and $LOG_DIR/frontend.log"
echo "To stop services cleanly: ./scripts/stop.sh"
