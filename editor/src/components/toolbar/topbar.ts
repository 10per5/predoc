import { html, render } from "lit-html"
import { unsafeHTML } from "lit-html/directives/unsafe-html.js"
import { colors } from "../../theme"
import type { Editor } from "@milkdown/kit/core"
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core"
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  toggleInlineCodeCommand,
  wrapInHeadingCommand,
  insertHrCommand,
} from "@milkdown/kit/preset/commonmark"
import { toggleStrikethroughCommand } from "@milkdown/kit/preset/gfm"
import { mountLinkDialog } from "../dialogs/link-dialog"
import type { ViewType } from "../views/view"
import {
  boldIcon, italicIcon, strikethroughIcon, codeIcon, linkIcon, dividerIcon,
} from "../icons"

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
    onToggleSidebar?: () => void
    onToggleMetaPanel?: () => void
  },
): TopbarAPI {
  const counterId = "dirty-counter-" + Math.random().toString(36).slice(2)
  const flushId = "flush-btn-" + Math.random().toString(36).slice(2)
  const providerId = "provider-badge-" + Math.random().toString(36).slice(2)
  const viewEditorId = "view-editor-" + Math.random().toString(36).slice(2)
  const viewStatsId = "view-stats-" + Math.random().toString(36).slice(2)
  const saveBtnId = "save-btn-" + Math.random().toString(36).slice(2)
  const loadBtnId = "load-btn-" + Math.random().toString(36).slice(2)

  const exec = (cmd: string, ...args: unknown[]) => {
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
        case "heading":
          commands.call(wrapInHeadingCommand.key, ...args)
          break
        case "hr":
          commands.call(insertHrCommand.key)
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
        <button @click=${() => callbacks.onToggleSidebar?.()} title="Toggle Sidebar" class="mobile-only" style="display:none">☰</button>
        <span class="toolbar-sep mobile-only" style="display:none"></span>
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
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
        </button>
        <button class="toolbar-view-btn" id="${viewStatsId}" @click=${() => callbacks.onViewChange("disk-usage")} title="Disk Usage">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
        </button>
      </div>
      <span class="toolbar-sep"></span>
      <div class="toolbar-section toolbar-section-center">
        <span class="toolbar-heading-wrap">
          <button class="toolbar-heading-btn" @click=${() => {
            const el = container.querySelector(".toolbar-heading-dropdown") as HTMLElement
            el?.classList.toggle("open")
          }} title="Heading">
            <span class="heading-label">H</span>
          </button>
          <div class="toolbar-heading-dropdown">
            <button @click=${() => exec("heading", 1)} data-h="1">H1</button>
            <button @click=${() => exec("heading", 2)} data-h="2">H2</button>
            <button @click=${() => exec("heading", 3)} data-h="3">H3</button>
          </div>
        </span>
        <button @click=${() => exec("bold")} title="Bold (Ctrl+B)">${unsafeHTML(boldIcon)}</button>
        <button @click=${() => exec("italic")} title="Italic (Ctrl+I)">${unsafeHTML(italicIcon)}</button>
        <button @click=${() => exec("strike")} title="Strikethrough">${unsafeHTML(strikethroughIcon)}</button>
        <button @click=${() => exec("code")} title="Inline Code">${unsafeHTML(codeIcon)}</button>
        <button @click=${() => exec("hr")} title="Insert Horizontal Rule">${unsafeHTML(dividerIcon)}</button>
        <span class="toolbar-sep"></span>
        <button @click=${() => exec("link")} title="Insert Link">${unsafeHTML(linkIcon)}</button>
        <span class="toolbar-sep"></span>
        <button data-action="editor#toggleSource" title="Source Mode">{ }</button>
        <span class="toolbar-sep"></span>
        <button @click=${() => callbacks.onToggleMetaPanel?.()} title="Meta Panel" class="mobile-only" style="display:none">⚙</button>
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
