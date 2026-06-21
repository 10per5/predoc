# TODO — predoc editor improvements

## ✅ Done

### Bug #1 — Shortcode escape fix
- `fixShortcodeEscape` (remark SchemaReady mutation) removed — was unreliable
- Replaced with `remarkStringifyOptionsCtx` text handler override in config: skips `state.safe()` for text containing `{{`, preventing escaping at the source
- `normalizeMd` removed entirely — no post-processing needed
- Removed `remark-disable-text-escape` dependency

### Bug #2 — Shortcode inner decoration coloring
- Overlapping `Decoration.inline` ranges conflicted (PM merges attrs but unreliably)
- Split into 3 non-overlapping segments per match: prefix, inner, suffix
- Inner segment gets combined class `shortcode-tag shortcode-inner`

### Dead code removed
- Deleted: `editor-navigate.ts` (100% unused)
- Trimmed: `editor-actions.ts` — removed `deletePage`, `renamePage`, `movePage` (imported but never called)
- Imports in `editor_controller.ts` cleaned up
- Removed `remark-disable-text-escape` dep from `package.json`

## ⏳ Next

### Shortcode type colors
- Add `.shortcode-mermaid`, `.shortcode-katex`, `.shortcode-tabs`, `.shortcode-figure`, `.shortcode-hint` CSS classes
- Color palette: mermaid=green, katex=purple, tabs=orange, figure=blue, hint=yellow
- Zero plugin code changes — regex already captures all types

### Crepe learnings to apply

| Crepe feature | What to borrow | Priority |
|---|---|---|
| `/` slash menu | Theirs invokes reliably, ours is buggy. Rewrite using same `SlashProvider` pattern but with proper `shouldShow` / `onShow` lifecycle. Study `feature/block-edit/menu/` for menu structure. | Medium |
| Block handles (drag grip + `+`) | `feature/block-edit/handle/` — drag handle on left gutter + `+` button to open insert menu. We have `block` plugin but no custom handles. | Low |
| AI integration | See how `/` command integrates AI actions. `feature/ai/` uses `instruction-tooltip` — may wire into slash menu or toolbar. Understand pattern for future. | Low |
| GroupBuilder pattern | `utils/group-builder.ts` — fluent builder for toolbar/menu groups. Adopt for any menu UI we build. | Low |

### Formatting toolbar
- NOT a separate feature — wire into our existing app toolbar
- Add bold, italic, strikethrough, code, link, heading selector buttons
- Bind Milkdown commands: `toggleStrongCommand`, `toggleEmphasisCommand`, `toggleStrikethroughCommand`, `toggleInlineCodeCommand`, `toggleLinkCommand`, `setBlockTypeCommand` (headings)
- Active state via `isMarkSelectedCommand` + stored mark fallback (from Crepe's `isMarkActive`)

### Keyboard shortcuts
- `Ctrl+B` → bold, `Ctrl+I` → italic, `Ctrl+K` → link, `Ctrl+Shift+X` → strikethrough, `Ctrl+Alt+C` → inline code
- Register via `editorViewOptionsCtx` or `$prose` plugin

### LaTeX math (stretch)
- Add `katex` + `remark-math` deps
- `$remark` plugin for remark-math → MDAST `inlineMath`/`math` nodes
- `$nodeSchema` for inline/block math with katex rendering
- Input rules for `$...$` and `$$...$$`
- Follow Crepe `feature/latex/` structure

### Image paste/upload (stretch)
- Enable `@milkdown/kit/plugin/upload`
- Paste image → upload or data URI → insert image-block node
