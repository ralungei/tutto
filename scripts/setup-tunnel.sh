#!/bin/bash
# Tutto - Setup remote access via Cloudflare Tunnel
# This allows you to access Tutto from your iPhone or anywhere
#
# Prerequisites:
#   - A Cloudflare account (free)
#   - cloudflared installed: brew install cloudflare/cloudflare/cloudflared
#
# Usage:
#   1. First time: ./scripts/setup-tunnel.sh login
#   2. Start tunnel: ./scripts/setup-tunnel.sh start
#   3. Quick tunnel (no account needed): ./scripts/setup-tunnel.sh quick

set -e

PORT=${TUTTO_PORT:-3000}

case "${1:-quick}" in
  login)
    echo "Opening Cloudflare login..."
    echo "After logging in, you can create a permanent tunnel."
    cloudflared tunnel login
    echo ""
    echo "Now run: ./scripts/setup-tunnel.sh create"
    ;;

  create)
    echo "Creating tunnel 'tutto'..."
    cloudflared tunnel create tutto
    TUNNEL_ID=$(cloudflared tunnel list | grep tutto | awk '{print $1}')
    echo ""
    echo "Tunnel created! ID: $TUNNEL_ID"
    echo ""
    echo "Now configure DNS:"
    echo "  cloudflared tunnel route dns tutto tutto.yourdomain.com"
    echo ""
    echo "Then run: ./scripts/setup-tunnel.sh start"
    ;;

  start)
    echo "Starting Tutto tunnel on port $PORT..."
    echo "Make sure 'npm run dev' is running in another terminal."
    echo ""
    cloudflared tunnel --url http://localhost:$PORT
    ;;

  quick)
    echo "======================================"
    echo "  Tutto - Quick Remote Access"
    echo "======================================"
    echo ""
    echo "Starting quick tunnel to localhost:$PORT..."
    echo "Make sure 'npm run dev' is running in another terminal."
    echo ""
    echo "A public URL will appear below."
    echo "Open it on your iPhone to use Tutto!"
    echo ""
    cloudflared tunnel --url http://localhost:$PORT
    ;;

  *)
    echo "Usage: $0 {login|create|start|quick}"
    echo ""
    echo "  quick  - Start a temporary tunnel (no account needed)"
    echo "  login  - Login to Cloudflare"
    echo "  create - Create a permanent tunnel"
    echo "  start  - Start the permanent tunnel"
    exit 1
    ;;
esac
