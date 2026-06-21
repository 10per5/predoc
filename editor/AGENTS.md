# Agent Notes — predoc editor

## Supported Formatting in WYSIWYG

- **CommonMark** — via `@milkdown/kit/preset/commonmark`
- **GFM** — via `@milkdown/kit/preset/gfm` (tables, strikethrough, task lists, auto-links)
- **Markdown alerts** (`> [!NOTE]`, `> [!WARNING]`, etc.) — custom `$remark` + `$nodeSchema` in `src/plugins/alert.ts`
  - Transforms MDAST blockquote nodes with `[!TYPE]` prefix into custom `alert` nodes
  - Renders as `<blockquote class="book-hint TYPE">` in the editor
  - Serializes back to `> [!TYPE] ...` syntax
  - Supported types: note, tip, important, warning, caution, info, success, danger

## Clipboard / Paste

- `@milkdown/plugin-clipboard` activated via `.use(clipboard)`
- Handles VS Code paste detection (code block with language)
- Handles Google Docs multi-table paste (strips `docs-internal-guid` wrapper)
- If rich paste formatting is still lost, add a `$prose` plugin with turndown HTML→Markdown conversion

## Hugo Shortcodes — Decoration + Text Handler Override

Shortcodes use `src/plugins/shortcode.ts`:

1. **`$prose` decoration plugin** (`shortcodeDecoration`): Styles `{{<...>}}` / `{{%...%}}` text patterns as styled badges. Uses a stack-based approach to match opening/closing shortcode pairs and adds `.shortcode-body` decoration to content between them. Uses a local regex instance to avoid `lastIndex` conflicts.

2. **Text handler override** in `editor_controller.ts` config: Overrides the `text` handler via `remarkStringifyOptionsCtx`. For text nodes containing `{{`, returns the raw value directly (skipping `state.safe()`), preventing `[` from being escaped to `\[`. This avoids `$remark` race condition issues since it's applied in the config callback.

Regex (decoration): `/\{\{(<|%)\s*\/?\s*(\w+(?:\.\w+)?)((?:\s+(?:"[^"]*"|\[[^\]]*\]|\S+))*)\s*[>%]\}\}/g`

Supported syntax:
| Part | Class | Style |
|---|---|---|
| Shortcode tag | `.shortcode-tag` | gray border, monospace |
| Content between paired tags | `.shortcode-body` | subtle blue background |
| `{{< param ... >}}` | `.shortcode-param` | teal border |
| `{{< details ... >}}` / `{{< /details >}}` | `.shortcode-detail-tag` | blue border, bold |
| `{{% ... %}}` | `.shortcode-percent` | purple border, italic |

## Backend Compatibility

Only backend: **Hugo + Hugo Book theme** (v0.14.0)

- Formatting table in `content/docs/backends.md`
- Hugo Book shortcode reference: https://book.alxs.dev/docs/content/shortcodes/
- Hugo shortcode reference: https://gohugo.io/content-management/shortcodes/
