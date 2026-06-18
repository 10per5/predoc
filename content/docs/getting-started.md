---
title: Getting Started
weight: 1
---

# Getting Started

## Prerequisites

- [Docker](https://docs.docker.com/engine/install/) — primary build method
- Or [premake5](https://premake.github.io/download) + C++23 compiler + Qt6 + Saucer for native builds

Hugo and the Book theme are downloaded automatically by `predoc fetch-deps`.

## Quick Start

```bash
# Build the CLI
cd cli && bash build.sh

# Build the GUI
cd gui && bash build.sh

# Launch the editor
cd .. && cli/bin/predoc

# With debug logging
cli/bin/predoc --debug
```

## Commands

| Command | Description |
|---|---|---|
| `predoc` (no subcommand) | Launch the native GUI window with the editor |
| `predoc --debug` | Same, with verbose debug output |
| `predoc fetch-deps` | Download Hugo binary + Book theme to cache |
| `predoc package` | Build editor assets + GUI binary, assemble output |

## Content

predoc reads and writes markdown from the `content/` directory. The directory tree is the page hierarchy — `content/docs/foo.md` appears as `/docs/foo` in the editor.

The home page is `content/_index.md`. When the editor loads with no specific path, it defaults to `_index` and displays it as "Home" in the sidebar.
