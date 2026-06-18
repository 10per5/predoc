---
title: Static Site Generator
weight: 30
---

# Static Site Generator

The SSG layer converts markdown content into a fully static HTML site using [Hugo](https://gohugo.io) and the [Book theme](https://github.com/alex-shpak/hugo-book) by Alex Shpak (MIT).

## Why Hugo

Hugo is the most popular static site generator — mature, fast (sub-second builds), and distributed as a single binary. No runtime dependencies.

## Why Book Theme

The [Hugo Book theme](https://themes.gohugo.io/themes/hugo-book/) (~4k stars, MIT) is built for documentation:

- Clean, minimal, mobile-friendly design
- Works without JavaScript
- Dark mode, search, multi-language support
- Useful shortcodes: hints, tabs, expand/collapse, mermaid diagrams

## Dependencies

`predoc fetch-deps` downloads:
- **Hugo** → `~/.cache/predoc/bin/hugo` (auto-detected on PATH)
- **Book theme** → `ssg/themes/book/`

Both are downloaded on first use if missing.

## Build

```bash
# Manual Hugo build
cd ssg
hugo --source . \
     --contentDir ../content \
     --themesDir themes \
     --theme book \
     --destination build

# Or via the SSG CLI
predoc package
```

Output: `ssg/build/` — a portable static site compatible with GitHub Pages, Netlify, Surge, Vercel, or plain S3.
