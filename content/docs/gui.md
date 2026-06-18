---
title: GUI
weight: 15
---

# GUI Architecture

The GUI is a standalone C++23 desktop application built with [Saucer](https://github.com/saucer/saucer), which wraps Qt6 WebEngine on Linux (with WebKitGTK, WKWebView, and WebView2 backends available for other platforms).

## Content Serving

The GUI does **not** start a TCP server. Instead, it registers a custom `app://` URL scheme via Saucer's `handle_scheme()` API. This is an in-process handler that intercepts all navigation and sub-resource requests — no port, no thread, no special permissions.

```
app://_/index.html          → serves editor/public/index.html
app://_/assets/app.js       → serves editor static files
app://_/content/my-page.md  → reads/writes content/my-page.md
app://_/api/tree            → returns JSON tree of content/
app://_/api/move            → renames/moves content files
```

All Saucer backends support custom URL schemes (Qt WebEngine via `QWebEngineUrlSchemeHandler`, WebKitGTK via `webkit_web_context_register_uri_scheme`, etc.), making this approach fully cross-platform.

## Runtime Flow

```
cli/bin/predoc
  └─ fork/exec: gui/bin/predoc-gui
       --editor-root <root>/editor
       --content-root <root>/content
       [--debug]

       └─ Saucer creates native OS window
            ├─ registers app:// scheme handler
            ├─ loads app://_/ (→ index.html)
            ├─ editor JS fetch() → app:// handler → filesystem
            └─ on window close → Saucer exits → CLI exits
```

## Flags

| Flag | Description |
|---|---|
| `--editor-root <path>` | Path to editor directory (must contain `public/`) |
| `--content-root <path>` | Path to content markdown directory |
| `--port <n>` | Connect to an external HTTP server instead of app:// |
| `--live-port <n>` | Hugo preview server URL for the "Preview" button |
| `--favicon <path>` | Custom window icon |
| `--disable-gpu` | Disable hardware acceleration |
| `--debug` | Verbose debug logging to stderr |

## Entry Point (`src/main.cpp`)

The entry point parses CLI flags, registers the `app://` scheme (via `saucer::webview::register_scheme("app")`), then enters the Saucer event loop:

1. Create a native OS window
2. Create a `saucer::smartview` (webview + JS bridge)
3. Register the scheme handler with `webview.handle_scheme("app", handler)`
4. Set URL to `app://_/` and show the window
5. Block until the window closes

The scheme handler routes requests by path prefix:
- `content/` → filesystem operations (GET, PUT, DELETE, HEAD)
- `api/tree` → builds JSON tree from content directory
- `api/move` → renames/moves content files
- Everything else → static files from `editor_root/public/`

## License Notes

| Component | License | Linkage |
|---|---|---|
| predoc-gui | MIT | — |
| Saucer | MIT | Static (compiled into binary) |
| Qt6 (Widgets, WebEngine, WebChannel) | LGPL 3.0 | Dynamic (`.so` at runtime) |

Qt6 is dynamically linked — users get it from their system package manager. This is the standard arrangement for Qt applications and allows free redistribution.
