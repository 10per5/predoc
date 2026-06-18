---
title: Roadmap
weight: 40
---

# Roadmap

## Git Integration

Auto-commit and push before each flush. Snapshot copies before writes would provide undo history beyond the in-memory buffer.

## Single Binary

Embed editor assets and Hugo into the CLI binary for a truly portable single-file executable.

## SSG Pipeline Enhancements

- Flush pending edits from browser buffer to disk before build
- Auto-generate or update `hugo.toml`
- Watch mode: rebuild on content changes

## Platform Support

Saucer supports Qt WebEngine (Linux), WebKitGTK (Linux), WKWebView (macOS), and WebView2 (Windows). The `app://` scheme handler works on all backends — adding macOS/Windows GUI builds is a Dockerfile change.

## Filesystem Mounting

Detect mounted content volumes at startup. A future File System Access API (FSAA) fallback would let the browser read/write local files in environments without a GUI binary.
