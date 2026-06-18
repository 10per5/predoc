# predoc-editor builder
#
# Single-stage: produce editor static assets, extract via docker cp.
# Builds the Milkdown editor frontend (TypeScript + CSS) via Bun.
#
# Static files (index.html, favicon.ico) come from static/;
# the build writes assets/app.js + app.css into public/.
#
# Usage:
#   docker build -t predoc-editor -f editor/Dockerfile .
#   docker create --name tmp predoc-editor
#   docker cp tmp:/output/editor/public/. ./editor/public/
#   docker rm tmp

FROM debian:trixie-slim AS builder

RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /src

COPY editor/package.json ./
RUN bun install

COPY editor/src/ src/
COPY editor/static/ public/
RUN bun run build

FROM debian:trixie-slim
COPY --from=builder /src/public/ /output/editor/public/
