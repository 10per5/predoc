---
title: Alternatives
weight: 20
---

# Alternatives

Other editors and platforms that overlap with predoc's space.

Notable difference across all these: predoc ships as a single <2 MB binary (<1 MB on Linux) with no runtime dependencies. It doesn't require a server but supports 3 different file APIs (local, SFTP, S3), with future cloud sync planned.

---

## Anytype

**Site:** [https://anytype.io/](https://anytype.io/)

A full framework for editing documents, more like a workspace aggregator than an editor. Offline-first, local-first, with encrypted peer-to-peer sync. Highly multiplatform — supports desktop (Windows, macOS, Linux), iOS, and Android natively.

| Strength | Weakness |
| -------- | -------- |
| Strong local-first, offline-capable architecture; encrypted P2P sync built in | Heavy desktop app built on Electron — large bundle size vs predoc's <2 MB footprint |
| Highly extensible object model (types, relations, templates); native mobile apps | Not a lightweight editor; more of a personal knowledge base platform with a steep learning curve |

**Why choose Anytype over predoc?** You want an all-in-one encrypted knowledge base with offline-first sync, native mobile apps, and a rich object model rather than a focused document editor.

---

## Docmost

**Site:** [https://docmost.com/](https://docmost.com/) — **Repo:** [https://github.com/docmost/docmost](https://github.com/docmost/docmost)

Open source / cloud-based self-hosted editor. Full-featured with real-time collaboration and file format support for import and export. Delivered as a web app with an optional Electron-based desktop wrapper.

| Strength | Weakness |
| -------- | -------- |
| Real-time collaborative editing with rich import/export (Markdown, HTML, etc.) | Requires a server (Node.js + database) to self-host; heavier operational overhead |
| Open source (MIT), can self-host or use their cloud offering | Electron-based desktop app is large compared to predoc's native binary; feature set is opinionated |

**Why choose Docmost over predoc?** You need real-time collaboration across a team and want a self-hosted wiki-like editor with broad import/export support.

---

## Otterwiki

**Site:** **Repo:** [https://github.com/redimp/otterwiki](https://github.com/redimp/otterwiki)

Python-based, block editor, similar in style. Uses Flask, Halfmoon CSS, and CodeMirror as editor.

| Strength | Weakness |
| -------- | -------- |
| Lightweight Python/Flask app — easy to deploy and hack on | Smaller community and fewer integrations than larger wiki platforms |
| Block-based editing feels similar to predoc's approach; familiar UI | Less polished than commercial alternatives; feature set is more basic |

**Why choose Otterwiki over predoc?** You prefer a Python ecosystem, want a lightweight self-hosted wiki with block editing, and value similarity in editing style.

---

## MkDocs

**Site:** [https://www.mkdocs.org/](https://www.mkdocs.org/)

A static site generator built in Python that turns Markdown files into documentation sites. Supports multiple themes and easy deployment to GitHub Pages. Similar in spirit to predoc's Hugo-based backend — write markdown, get a static site.

| Strength | Weakness |
| -------- | -------- |
| Simple to set up — single `mkdocs.yml` config, no templating required | No built-in editor; you bring your own (IDE, text editor, etc.) |
| First-class GitHub Pages deployment (`mkdocs gh-deploy`); rich plugin ecosystem | Python runtime dependency; predoc ships as a single zero-dependency binary |

**Why choose MkDocs over predoc?** You want a pure Python documentation site generator with a large plugin ecosystem and tight GitHub Pages integration, and don't need a built-in editor.

---

## Docusaurus

**Site:** [https://docusaurus.io/](https://docusaurus.io/)

A React-based static site generator for documentation sites. Initially inspired the design of predoc, but lacks a dedicated desktop editing experience and ships a heavy React framework bundle.

| Strength | Weakness |
| -------- | -------- |
| Feature-rich — versioned docs, search, blog, i18n, MDX out of the box | Heavy React SPA — large JS bundle compared to predoc's static HTML output |
| Strong theming and plugin ecosystem powered by React | No desktop app — editing requires a separate editor; build tooling (Node.js/npm) is a prerequisite |

**Why choose Docusaurus over predoc?** You need a full-featured documentation site with versioning, i18n, and React-based theming, and don't mind the Node.js toolchain overhead.
