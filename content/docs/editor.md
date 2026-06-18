---
title: Editor
weight: 20
---

# Editor

The editor is a Milkdown v7 WYSIWYG interface loaded inside the native GUI window. All content API calls go through the `app://` scheme handler (in-process, no HTTP server — see [GUI](/docs/gui)).

## Milkdown

[Milkdown](https://milkdown.dev) (v7, 11k+ stars) is the core editor. It's built on ProseMirror + Remark and works with markdown natively — no HTML→MD→HTML roundtrip. Both WYSIWYG and raw markdown source modes are available via toggle.

## Hotwired (Turbo + Stimulus)

Navigation and interaction use [Hotwired](https://hotwired.dev):

- **Turbo Drive** — SPA-like navigation without client-side routing
- **Turbo Frames** — Inline editing without hand-coded fetch calls
- **Stimulus** — Tiny controllers for editor mount/unmount, mode toggle, save buffer, flush

Combined bundle: **~28KB gzip**.

## Flush-Based Writes

Edits accumulate in an in-memory buffer + IndexedDB (crash recovery). The filesystem is only touched on explicit "Flush" or page navigation. This prevents partial writes and reduces I/O.

## Initial Page

When the editor loads at the root URL (`/`), it defaults to `content/_index.md` (the home page). `_index.md` is displayed as "Home" in the sidebar and maps to the `/` URL path.
