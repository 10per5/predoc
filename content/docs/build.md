---
title: Build
weight: 2
---

# Build

predoc uses [predep](https://github.com/10per5/predep) to orchestrate all build recipes. predep is a self-building tool — it compiles itself and then executes the stages defined in `predep.toml` files throughout the project.

To build everything:

```bash
predep build
```

Or via Docker:

```bash
predep build-docker
```

To assemble a release archive:

```bash
predep package
```

## Build Steps

All build recipes are declared in `predep.toml` at each subproject root, the root [`predep.toml`](https://github.com/10per5/predoc/blob/main/predep.toml) ties them together via `[[include]]` directives and defines the top-level `build` and `build-docker` stage groups.

### Build Artifacts

```
gui/bin/predoc-gui             # ~1.2MB — GUI binary (links Qt6 at runtime)
editor/public/assets/app.js  # Editor frontend JS (minified)
editor/public/assets/app.css # Editor frontend CSS (minified)
editor/public/index.html     # Static HTML shell
ssg/
  hugo.toml                  # Hugo configuration
  themes/book/               # Hugo Book theme (downloaded on fetch-deps)
```

These are the only files needed at runtime. Source files (`gui/src/`, `editor/src/`) and dev dependencies are not needed on the target machine.
