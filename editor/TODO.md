# TODO — predoc editor improvements

## ✅ Done

### Bug #1 — Shortcode escape fix
- `fixShortcodeEscape` (remark SchemaReady mutation) removed — was unreliable
- Replaced with `remarkStringifyOptionsCtx` text handler override in config: skips `state.safe()` for text containing `{{`, preventing escaping at the source
- `normalizeMd` removed entirely — no post-processing needed
- Removed `remark-disable-text-escape` dependency

### Bug #2 — Shortcode decoration (simplified)
- Overlapping `Decoration.inline` ranges fixed: now uses 1 decoration per shortcode match (no prefix/inner/suffix split)
- `.shortcode-body` added for content between matching opening/closing pairs via stack-based matching
- Removed `innerRange` and `addDeco` helpers — 24 lines removed

### Dead code removed
- Deleted: `editor-navigate.ts` (100% unused)
- Trimmed: `editor-actions.ts` — removed `deletePage`, `renamePage`, `movePage` (imported but never called)
- Imports in `editor_controller.ts` cleaned up
- Removed `remark-disable-text-escape` dep from `package.json`

---

## ✅ Phase 1 — App-wide improvements (high impact, targeted) — COMPLETE

### 1a. Slash menu enhanced (`editor-slash.ts`)
- Added SVG icons for all menu items (h1Icon, bulletListIcon, quoteIcon, etc.)
- Added items: code block, table, task list (11 items total)
- `renderItems()` generates icon + label per item
- Code block/table/task list inserted via ProseMirror schema manipulation
- Kept existing `shouldShow`, keyboard nav, highlight patterns

### 1b. Toolbar updated (`topbar.ts`)
- Added heading dropdown (H1/H2/H3) with styled popup
- Replaced all emoji/text icons with inline SVG icons
- View buttons use SVG icons (file/globe)

### 1c. Keyboard shortcuts (`keyboard.ts` — new)
- ProseMirror `keymap` plugin registered via `prosePluginsCtx`
- `Ctrl+B/I/\`` bold/italic/code, `Ctrl+Shift+S/X` strikethrough, `Ctrl+Alt+1/2/3` headings
- `Ctrl+Shift+7/8` ordered/bullet lists, `Ctrl+Shift+-` HR, `Ctrl+Z/Y` undo/redo

### 1d. Icons (`icons.ts` — updated)
- 25+ SVG icon strings imported from Crepe's icon set
- Both `lit-html` template and plain string exports

### 1e. Block handle configured
- `blockConfig.filterNodes` customized to reject tables/blockquotes
- Kept default drag handle behavior

### 1f. Link tooltip (`@milkdown/kit/component/link-tooltip`)
- `.use(linkTooltipPlugin)` + `.config(configureLinkTooltip)` wired in
- Provides hover preview + in-place edit/remove for links

### 1g. Placeholder (`placeholder-plugin.ts` — new)
- ProseMirror decoration plugin: `data-placeholder` attribute on empty paragraphs
- CSS `::after` pseudo-element for display
- Hidden in code blocks and lists

### 1h. List item enhancement
- `.use(listItemBlockComponent)` from `@milkdown/kit/component/list-item-block`
- Enables styled bullet markers and checkboxes

---

## Phase 2 — Larger features (stretch)

### 2a. Shortcode type colors
- CSS classes for mermaid, katex, tabs, figure, hint
- Zero plugin changes — regex already captures all types

### 2b. Table blocks
- Drag handles, row/col add/delete
- From Crepe `feature/table/`

### 2c. Image insertion
- Upload + drag/drop + paste → image-block node
- From Crepe `feature/image-block/`

### 2d. LaTeX math
- KaTeX inline `$...$` and block math
- From Crepe `feature/latex/`

---

## Future / To discuss

### AI integration — Concept (ObservableHQ / Jupyter-style)
- `/` invokes a command palette that includes an "AI generate" option
- Opens a prompt input box (like Crepe's `AIInstructionTooltip`) where user describes what they want
- AI generates markdown content and inserts it into the editor at cursor
- **Future considerations:**
  - Cell-based interface (like ObservableHQ where each block is a cell)
  - Multi-provider support (OpenAI, Anthropic, local)
  - Streaming response with diff review (accept/reject)
  - Potential integration with `/` menu for "Improve writing", "Fix grammar", "Continue", "Summarize"
  - Prompt history and favorites
- Not started — needs separate discussion and scoping

### Meta panel toggle
- View toggle like Crepe's middle panel
- Collapse/expand right-side metadata panel
- Future discussion

### Emoji picker
- Not in Crepe, low priority
