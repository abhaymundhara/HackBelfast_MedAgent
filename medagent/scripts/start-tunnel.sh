#!/usr/bin/env bash
# Start ngrok tunnel and launch dev server with public URL
# Usage: ./scripts/start-tunnel.sh [port]

set -euo pipefail

PORT="${1:-3000}"
ENV_FILE=".env.local"

# Check ngrok is installed
if ! command -v ngrok &>/dev/null; then
  echo "ngrok not found. Install it: https://ngrok.com/download"
  echo "  brew install ngrok   (macOS)"
  echo "  snap install ngrok   (Linux)"
  exit 1
fi

# Kill any existing ngrok
pkill -f "ngrok http" 2>/dev/null || true
sleep 1

# Start ngrok in background
echo "Starting ngrok tunnel on port $PORT..."
ngrok http "$PORT" --log=stdout > /dev/null &
NGROK_PID=$!
sleep 3

# Get public URL from ngrok API
NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | node -e "
  let data = '';
  process.stdin.on('data', c => data += c);
  process.stdin.on('end', () => {
    const tunnels = JSON.parse(data).tunnels;
    const https = tunnels.find(t => t.proto === 'https');
    console.log(https ? https.public_url : tunnels[0]?.public_url || '');
  });
")

if [ -z "$NGROK_URL" ]; then
  echo "Failed to get ngrok URL. Check ngrok is running."
  kill $NGROK_PID 2>/dev/null
  exit 1
fi

echo ""
echo "========================================="
echo "  ngrok tunnel: $NGROK_URL"
echo "========================================="
echo ""

# Update APP_BASE_URL in .env.local
if grep -q "^APP_BASE_URL=" "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^APP_BASE_URL=.*|APP_BASE_URL=$NGROK_URL|" "$ENV_FILE"
else
  echo "APP_BASE_URL=$NGROK_URL" >> "$ENV_FILE"
fi

echo "Updated $ENV_FILE with APP_BASE_URL=$NGROK_URL"
echo "Starting dev server..."
echo ""

# Cleanup on exit
trap "kill $NGROK_PID 2>/dev/null; sed -i 's|^APP_BASE_URL=.*|APP_BASE_URL=http://localhost:3000|' $ENV_FILE; echo 'Restored APP_BASE_URL to localhost'" EXIT

npm run dev
