#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
OUT_DIR="$SCRIPT_DIR/bin"

build_native() {
  echo "  -> Generating build files with premake5..."
  cd "$SCRIPT_DIR"
  premake5 gmake

  echo "  -> Compiling..."
  make config=redist -j"$(nproc)"

  if [ ! -f "$OUT_DIR/predoc-gui" ]; then
    echo "  ERROR: Binary not found at $OUT_DIR/predoc-gui" >&2
    exit 1
  fi

  echo "  -> Binary: $OUT_DIR/predoc-gui"
}

build_docker() {
  echo "  -> Building via Docker..."
  docker build -t predoc-gui "$SCRIPT_DIR"

  echo "  -> Extracting binary..."
  mkdir -p "$OUT_DIR"
  local container
  container="$(docker create predoc-gui)"
  docker cp "$container:/build/bin/predoc-gui" "$OUT_DIR/predoc-gui"
  docker rm "$container" >/dev/null

  echo "  -> Binary: $OUT_DIR/predoc-gui"
}

echo ""
echo "  [predoc-gui build]"
echo ""

cd "$SCRIPT_DIR"

if command -v premake5 &>/dev/null && [ -f /usr/local/include/saucer/webview.hpp ]; then
  build_native
elif command -v docker &>/dev/null; then
  echo "  Native deps not met (premake5 + saucer), falling back to Docker..."
  build_docker
else
  echo "  ERROR: cannot build predoc-gui" >&2
  echo "" >&2
  echo "  Either:" >&2
  echo "    - Install native build tools:" >&2
  echo "        premake5  (https://premake.github.io/download)" >&2
  echo "        saucer    (https://saucer.github.io/getting-started/)" >&2
  echo "        C++23 compiler (g++-13+ / clang-16+)" >&2
  echo "        Qt6 base + WebEngine dev packages" >&2
  echo "" >&2
  echo "        WebKitGTK:  libwebkitgtk-6.0-dev libgtk-4-dev libadwaita-1-dev" >&2
  echo "        or Qt6:      qt6-base-dev qt6-webengine-dev (Fedora 39+ / Arch)" >&2
  echo "" >&2
  echo "    - Or install Docker: https://docs.docker.com/engine/install/" >&2
  echo "" >&2
  exit 1
fi
