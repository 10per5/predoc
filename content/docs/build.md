---
title: Build
weight: 2
---

# Build

predoc produces two binaries from independent build steps. You can build on one machine and run on another — only the runtime artifacts need to be transferred.

## Build Steps

| Step | Command | Produces |
|---|---|---|
| CLI | `cli/build.sh` | `cli/bin/predoc` |
| GUI | `gui/build.sh` | `gui/bin/predoc-gui` |
| Editor JS | `editor/dev.sh build` | `editor/public/assets/app.js` |

Each build script prefers Docker and falls back to native tools if available.

### CLI (`cli/build.sh`)

Uses `cli/Dockerfile` (debian:trixie-slim, premake5 beta8, g++-15). Builds with C++23 and the vendored CLI11 header:

1. `docker build -t predoc-cli cli/`
2. `docker cp <container>:/build/bin/predoc cli/bin/`

Falls back to `premake5 gmake && make` if premake5 is available natively.

### GUI (`gui/build.sh`)

Uses `gui/Dockerfile` (debian:trixie-slim, Qt6 WebEngine, Saucer built from source):

1. `docker build -t predoc-gui gui/`
2. `docker cp <container>:/build/bin/predoc-gui gui/bin/`

Falls back to native build if premake5 and saucer headers are found at `/usr/local/include/saucer/`.

The Dockerfile is single-stage — the binary is extracted and runs on the host, dynamically linking the host's Qt6 at runtime.

## Build Artifacts

```
cli/bin/predoc                 # ~200KB — CLI binary (statically linked)
gui/bin/predoc-gui             # ~1.2MB — GUI binary (links Qt6 at runtime)
editor/public/assets/app.js  # Editor frontend JS (minified)
editor/public/assets/app.css # Editor frontend CSS (minified)
editor/public/index.html     # Static HTML shell

ssg/
  hugo.toml                  # Hugo configuration
  themes/book/               # Hugo Book theme (downloaded on fetch-deps)
```

These are the only files needed at runtime. Source files (`cli/src/`, `gui/src/`, `editor/src/`) and dev dependencies are not needed on the target machine.
