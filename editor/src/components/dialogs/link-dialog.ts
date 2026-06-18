import { html, render } from "lit-html"
import type { Editor } from "@milkdown/kit/core"
import { editorViewCtx } from "@milkdown/kit/core"
import { toggleMark } from "prosemirror-commands"

export function mountLinkDialog(getEditor: () => Editor | null) {
  const existing = document.getElementById("predoc-link-overlay")
  if (existing) existing.remove()

  const overlay = document.createElement("div")
  overlay.id = "predoc-link-overlay"
  document.body.appendChild(overlay)

  const milkdown = getEditor()
  let initialUrl = ""

  if (milkdown) {
    milkdown.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view
      const linkMark = state.schema.marks.link
      if (linkMark) {
        const mark = state.selection.$head.marks().find((m) => m.type === linkMark)
        if (mark) {
          initialUrl = mark.attrs.href ?? ""
        }
      }
    })
  }

  const inputId = "predoc-link-input-" + Math.random().toString(36).slice(2)

  const close = () => overlay.remove()

  const submit = () => {
    const input = document.getElementById(inputId) as HTMLInputElement
    const url = input?.value.trim()
    close()
    if (!url) return
    const editor = getEditor()
    if (!editor) return
    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      view.focus()
      const { state, dispatch } = view
      toggleMark(state.schema.marks.link, { href: url })(state, dispatch)
    })
  }

  const tmpl = html`
    <style>
      #predoc-link-overlay {
        position: fixed; inset: 0; z-index: 1000;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.3);
      }
      .predoc-link-box {
        background: #fff; border-radius: 8px; padding: 1rem 1.25rem;
        min-width: 320px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2); border: 1px solid #d8dee9;
      }
      .predoc-link-box label {
        display: block;
        font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;
        color: #8fbcbb; font-weight: 700; margin-bottom: 0.4rem;
      }
      .predoc-link-box input {
        width: 100%; padding: 0.4rem 0.6rem;
        border: 1px solid #d8dee9; border-radius: 4px;
        font-size: 0.9rem; margin-bottom: 0.75rem; box-sizing: border-box;
      }
      .predoc-link-box input:focus { outline: none; border-color: #5e81ac; }
      .predoc-link-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
      .predoc-link-actions button {
        padding: 0.35rem 1rem; border: 1px solid #d8dee9; border-radius: 4px;
        background: #fff; cursor: pointer; font-size: 0.85rem;
      }
      .predoc-link-actions button:hover { background: #e5e9f0; }
      .predoc-link-actions .predoc-link-save {
        background: #5e81ac; color: #fff; border-color: #5e81ac;
      }
      .predoc-link-actions .predoc-link-save:hover { background: #4a7098; }
    </style>
    <div class="predoc-link-box" @click=${(e: MouseEvent) => e.stopPropagation()}>
      <label for="${inputId}">URL</label>
      <input id="${inputId}" type="text" placeholder="https://example.com" .value=${initialUrl}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === "Enter") submit()
          if (e.key === "Escape") close()
        }}>
      <div class="predoc-link-actions">
        <button @click=${close}>Cancel</button>
        <button class="predoc-link-save" @click=${submit}>Save</button>
      </div>
    </div>
  `

  render(tmpl, overlay)
  overlay.addEventListener("click", close)

  requestAnimationFrame(() => {
    const input = document.getElementById(inputId) as HTMLInputElement
    input?.focus()
    input?.select()
  })
}
