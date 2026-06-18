#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "  [predoc-hugo-view build]"
echo ""

build_native() {
  echo "  -> Building static site with Hugo..."

  cd "$SCRIPT_DIR"
  hugo --source . \
       --contentDir ../content \
       --themesDir themes \
       --theme book \
       --destination build

  echo "  -> Output: $SCRIPT_DIR/build/"
}

build_docker() {
  echo "  -> Building via Docker..."
  docker build -t predoc-hugo-view "$SCRIPT_DIR"

  echo "  -> Extracting build..."
  local container
  container="$(docker create predoc-hugo-view)"
  docker cp "$container:/output/." "$SCRIPT_DIR/build/"
  docker rm "$container" >/dev/null

  echo "  -> Output: $SCRIPT_DIR/build/"
}

if command -v hugo &>/dev/null; then
  build_native
elif command -v docker &>/dev/null; then
  echo "  Hugo not found, falling back to Docker..."
  build_docker
else
  echo "  ERROR: cannot build hugo-view — install Hugo or Docker." >&2
  exit 1
fi
