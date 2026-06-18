#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/public"

echo ""
echo "  [predoc-editor build]"
echo ""

build_native() {
  echo "  -> Installing dependencies and building..."

  cd "$SCRIPT_DIR"

  if [ ! -d node_modules ]; then
    bun install
  fi

  cp -r "$SCRIPT_DIR/static/." "$OUT_DIR/" 2>/dev/null || true
  bun run build

  if [ ! -f "$OUT_DIR/assets/app.js" ]; then
    echo "  ERROR: Build failed — $OUT_DIR/assets/app.js not found" >&2
    exit 1
  fi

  echo "  -> Assets: $OUT_DIR/assets/"
}

build_docker() {
  echo "  -> Building via Docker..."
  docker build -t predoc-editor -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR/.."

  echo "  -> Extracting assets..."
  local container
  container="$(docker create predoc-editor)"
  docker cp "$container:/output/editor/public/." "$OUT_DIR/"
  docker rm "$container" >/dev/null

  echo "  -> Assets: $OUT_DIR/assets/"
}

if command -v bun &>/dev/null; then
  build_native
elif command -v docker &>/dev/null; then
  echo "  Bun not found, falling back to Docker..."
  build_docker
else
  echo "  ERROR: cannot build editor — install Bun or Docker." >&2
  exit 1
fi
