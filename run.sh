#!/bin/bash

# Kill background jobs on exit
trap 'kill $(jobs -p)' EXIT

echo "========================================================="
echo "   AKFD Material Request Portal - Bootstrapping Services"
echo "========================================================="

# Determine the absolute directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$DIR"

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "[-] Creating Python virtual environment..."
    python3 -m venv venv
    ./venv/bin/pip install -r backend/requirements.txt
fi

# Start Backend Server
echo "[+] Starting FastAPI backend on http://localhost:8080..."
./venv/bin/python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8080 --reload &

# Start Frontend Dev Server
echo "[+] Starting Vite React frontend on http://localhost:5173..."
npm run dev --prefix frontend &

# Wait for both processes
wait
