---
title: "Hugo Shortcodes"
weight: 20
---

# Hugo Shortcodes

Hugo and Hugo Book shortcodes are preserved as-is in the markdown source and highlighted as styled badges in the WYSIWYG editor.

## Supported Shortcodes

| Shortcode                        | Editor                        | Hugo + Book          |
| -------------------------------- | ----------------------------- | -------------------- |
| `{{</* hint info */>}}`          | 🔶 highlighted as badges      | ✅ (deprecated, use `> [!NOTE]`) |
| `{{</* details "Summary" */>}}`  | 🔶 highlighted as badges      | ✅ collapsible       |
| `{{</* param "name" */>}}`       | 🔶 highlighted as badges      | ✅ inline            |
| `{{</* tabs */>}}`               | 🔶 highlighted as badges      | ✅ tabbed content    |
| `{{</* mermaid */>}}`            | 🔶 highlighted as badges      | ✅ diagram rendering |
| `{{</* katex */>}}`              | 🔶 highlighted as badges      | ✅ math rendering    |
| `{{</* figure */>}}`             | 🔶 highlighted as badges      | ✅ image with caption|

## Reference

- [Hugo Book Shortcodes](https://book.alxs.dev/docs/content/shortcodes/)
- [Hugo Shortcodes](https://gohugo.io/content-management/shortcodes/)
