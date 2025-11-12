#!/bin/bash
# Helper script to kill process on port 5000

PORT=${1:-5000}

echo "🔍 Checking for processes on port $PORT..."

PID=$(lsof -ti:$PORT)

if [ -z "$PID" ]; then
  echo "✅ Port $PORT is free!"
else
  echo "🛑 Found process $PID using port $PORT"
  echo "💀 Killing process..."
  kill -9 $PID
  echo "✅ Port $PORT is now free!"
fi



