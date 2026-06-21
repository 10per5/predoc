---
title: Backends
weight: 30
---

# Backends

The editor stores plain markdown files in `content/`. The same files can be processed by supported backends to produce a static site. Currently, the only supported backend is **Hugo + Book theme**.

## Hugo + Book Theme

The SSG layer converts markdown content into a fully static HTML site using [Hugo](https://gohugo.io) and the [Book theme](https://github.com/alex-shpak/hugo-book) by Alex Shpak (MIT).

### Why Hugo

Hugo is the most popular static site generator — mature, fast (sub-second builds), and distributed as a single binary. No runtime dependencies.

### Why Book Theme

The [Hugo Book theme](https://themes.gohugo.io/themes/hugo-book/) (~4k stars, MIT) is built for documentation:

- Clean, minimal, mobile-friendly design
- Works without JavaScript
- Dark mode, search, multi-language support
- Useful shortcodes: hints, tabs, expand/collapse, mermaid diagrams

### Supported Formatting

| Feature                                 | Editor                   | Hugo + Book                      |
| --------------------------------------- | ------------------------ | -------------------------------- |
| CommonMark                              | ✅                       | ✅                               |
| GFM (tables, strikethrough, task lists) | ✅                       | ✅                               |
| Markdown alerts (`> [!NOTE]`)           | ✅ styled callout        | ✅ via `book-hint` CSS           |
| Hugo shortcodes (`{{</* … */>}}`)       | 🔶 highlighted as badges | ✅ full rendering                |
| `{{</* details */>}}`                   | 🔶 highlighted as badges | ✅ collapsible                   |
| `{{</* param */>}}`                     | 🔶 highlighted as badges | ✅ inline                        |
| `{{</* hint */>}}`                      | 🔶 highlighted as badges | ✅ (deprecated, use `> [!NOTE]`) |
| `{{</* tabs */>}}`                      | 🔶 highlighted as badges | ✅ tabbed content                |
| `{{</* mermaid */>}}`                   | 🔶 highlighted as badges | ✅ diagram rendering             |
| `{{</* katex */>}}`                     | 🔶 highlighted as badges | ✅ math rendering                |
| `{{</* figure */>}}`                    | 🔶 highlighted as badges | ✅ image with caption            |

For unimplemented shortcodes, the raw `{{</* … */>}}` syntax is preserved in the markdown source and highlighted as a badge in the editor. The Hugo build processes them correctly.

### Dependencies

`predoc fetch-deps` downloads:

- **Hugo** → `~/.cache/predoc/bin/hugo` (auto-detected on PATH)
- **Book theme** → `ssg/themes/book/`

Both are downloaded on first use if missing.

### Build

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

## Formatting Reference

### Markdown Alerts

GitHub-style blockquote alerts render as colored callout blocks in both the editor and the Hugo site:

```markdown
> [!NOTE]
> Useful information.

> [!WARNING]
> Proceed with caution.

> [!DANGER]
> This may cause issues.
```

Supported types: `note`, `tip`, `important`, `warning`, `caution`, `info`, `success`, `danger`.

### Hugo Shortcodes

For the full list of Hugo Book shortcodes, see:

- <https://book.alxs.dev/docs/content/shortcodes/>
- <https://gohugo.io/content-management/shortcodes/>
