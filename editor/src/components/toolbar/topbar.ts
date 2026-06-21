import { html, render } from "lit-html"
import { colors } from "../../theme"
import type { Editor } from "@milkdown/kit/core"
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core"
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
} from "@milkdown/kit/preset/commonmark"
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm"
import { mountLinkDialog } from "../dialogs/link-dialog"
import type { ViewType } from "../views/view"

export interface TopbarAPI {
  updateCounter(count: number, totalBytes: number): void
  setDirtyState(hasDirty: boolean): void
  setProviderBadge(icon: string, label: string): void
  setProviderType(type: string): void
  setView(view: ViewType): void
}

export function mountTopbar(
  container: HTMLElement,
  getEditor: () => Editor | null,
  callbacks: {
    onPrefs: () => void
    onDirtyClick?: () => void
    onChangeProvider: () => void
    onViewChange: (view: ViewType) => void
    onSave?: () => void
    onLoad?: () => void
  },
): TopbarAPI {
  const counterId = "dirty-counter-" + Math.random().toString(36).slice(2)
  const flushId = "flush-btn-" + Math.random().toString(36).slice(2)
  const providerId = "provider-badge-" + Math.random().toString(36).slice(2)
  const viewEditorId = "view-editor-" + Math.random().toString(36).slice(2)
  const viewStatsId = "view-stats-" + Math.random().toString(36).slice(2)
  const saveBtnId = "save-btn-" + Math.random().toString(36).slice(2)
  const loadBtnId = "load-btn-" + Math.random().toString(36).slice(2)

  const exec = (cmd: string) => {
    const milkdown = getEditor()
    if (!milkdown) return
    milkdown.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      view.focus()
      const commands = ctx.get(commandsCtx)
      switch (cmd) {
        case "bold":
          commands.call(toggleStrongCommand.key)
          break
        case "italic":
          commands.call(toggleEmphasisCommand.key)
          break
        case "strike":
          commands.call(toggleStrikethroughCommand.key)
          break
        case "code":
          commands.call(toggleInlineCodeCommand.key)
          break
        case "link":
          mountLinkDialog(getEditor)
          break
      }
    })
  }

  container.classList.add("app-toolbar")
  container.addEventListener("click", (e) => {
    const target = e.target as HTMLElement
    if (target.closest(".dirty-counter")?.classList.contains("clickable")) {
      callbacks.onDirtyClick?.()
    }
  })

  const tmpl = html`
      <div class="toolbar-section toolbar-section-left">
        <button class="toolbar-provider" id="${providerId}" @click=${() => callbacks.onChangeProvider()} title="Change project">
          ☁️ Server
        </button>
        <button class="toolbar-save-btn" id="${saveBtnId}" @click=${() => callbacks.onSave?.()} title="Save all to zip" style="display:none">
          💾 Save
        </button>
        <button class="toolbar-load-btn" id="${loadBtnId}" @click=${() => callbacks.onLoad?.()} title="Load from zip" style="display:none">
          📂 Load
        </button>
        <span class="toolbar-sep"></span>
        <button class="toolbar-view-btn active" id="${viewEditorId}" @click=${() => callbacks.onViewChange("editor")} title="Editor">
          📝
        </button>
        <button class="toolbar-view-btn" id="${viewStatsId}" @click=${() => callbacks.onViewChange("disk-usage")} title="Disk Usage">
          📊
        </button>
      </div>
      <span class="toolbar-sep"></span>
      <div class="toolbar-section toolbar-section-center">
        <button @click=${() => exec("bold")} title="Bold"><b>B</b></button>
        <button @click=${() => exec("italic")} title="Italic"><i>I</i></button>
        <button @click=${() => exec("strike")} title="Strikethrough"><s>S</s></button>
        <button @click=${() => exec("code")} title="Inline Code">{ }</button>
        <button @click=${() => exec("link")} title="Insert Link">🔗</button>
        <button data-action="editor#toggleSource" title="Source Mode">&lt;/&gt;</button>
      </div>
      <div class="toolbar-spacer"></div>
      <div class="toolbar-section toolbar-section-right">
        <span class="dirty-counter" id="${counterId}"></span>
        <button id="${flushId}" class="flush-btn" data-action="editor#flush" disabled>Flush</button>
        <button @click=${callbacks.onPrefs} title="Preferences">⚙</button>
      </div>
  `

  render(tmpl, container)

  return {
    updateCounter(count: number, totalBytes: number) {
      const el = document.getElementById(counterId)
      if (!el) return
      if (count === 0) {
        el.textContent = ""
        el.classList.toggle("clickable", false)
        return
      }
      const sign = totalBytes >= 0 ? "+" : "-"
      const abs = Math.abs(totalBytes)
      const size = abs < 1024
        ? `${sign}${abs} B`
        : `${sign}${(abs / 1024).toFixed(1)} KB`
      const color = totalBytes > 0 ? colors.green : totalBytes < 0 ? colors.danger : 'inherit'
      el.innerHTML = `<div class="dirty-count">${count} unsaved</div><div class="dirty-size" style="color:${color}">${size}</div>`
      el.classList.toggle("clickable", true)
    },
    setDirtyState(hasDirty: boolean) {
      const flush = document.getElementById(flushId) as HTMLButtonElement
      if (flush) flush.disabled = !hasDirty
    },
    setProviderBadge(icon: string, label: string) {
      const el = document.getElementById(providerId)
      if (el) el.innerHTML = `${icon} ${label}`
    },
    setProviderType(type: string) {
      const show = type === "localStorage"
      const saveBtn = document.getElementById(saveBtnId)
      const loadBtn = document.getElementById(loadBtnId)
      if (saveBtn) saveBtn.style.display = show ? "" : "none"
      if (loadBtn) loadBtn.style.display = show ? "" : "none"
    },
    setView(view: ViewType) {
      const editorBtn = document.getElementById(viewEditorId)
      const statsBtn = document.getElementById(viewStatsId)
      editorBtn?.classList.toggle("active", view === "editor")
      statsBtn?.classList.toggle("active", view === "disk-usage")
    },
  }
}
