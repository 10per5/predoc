import { html, render } from "lit-html"
import type { ViewType } from "../views/view"

export interface FileMenuCallbacks {
  onChangeProvider: () => void
  onViewChange: (view: ViewType) => void
  onSave?: () => void
  onLoad?: () => void
  onImageManager?: () => void
}

export interface FileMenuAPI {
  setProviderBadge(icon: string, label: string): void
  setView(view: ViewType): void
}

export function mountFileMenu(
  mountEl: HTMLElement,
  callbacks: FileMenuCallbacks,
): FileMenuAPI {
  const menuTriggerId = "file-trigger-" + Math.random().toString(36).slice(2)
  const menuId = "file-menu-" + Math.random().toString(36).slice(2)
  const menuProviderIconId = "menu-p-icon-" + Math.random().toString(36).slice(2)
  const menuProviderLabelId = "menu-p-label-" + Math.random().toString(36).slice(2)
  const viewEditorId = "menu-v-editor-" + Math.random().toString(36).slice(2)
  const viewStatsId = "menu-v-stats-" + Math.random().toString(36).slice(2)

  const close = () => {
    document.getElementById(menuId)?.classList.remove("open")
  }

  const tmpl = html`
    <button class="toolbar-menu-trigger" id="${menuTriggerId}" title="File">
      File<span class="arrow">▾</span>
    </button>
    <div class="toolbar-menu" id="${menuId}">
      <div class="menu-item" @click=${() => { callbacks.onChangeProvider(); close() }}>
        <span class="menu-item-icon" id="${menuProviderIconId}">☁️</span>
        <span class="menu-item-label" id="${menuProviderLabelId}">Server</span>
      </div>
      <div class="menu-sep"></div>
      <div class="menu-item menu-item-submenu">
        <span class="menu-item-label">View</span>
        <span class="menu-submenu-arrow">▸</span>
        <div class="menu-submenu">
          <div class="menu-item active" id="${viewEditorId}" @click=${() => { callbacks.onViewChange("editor"); close() }}>
            <span>Editor</span>
            <span class="check">✓</span>
          </div>
          <div class="menu-item" id="${viewStatsId}" @click=${() => { callbacks.onViewChange("disk-usage"); close() }}>
            <span>Disk Usage</span>
            <span class="check">✓</span>
          </div>
        </div>
      </div>
      <div class="menu-sep"></div>
      <div class="menu-item" @click=${() => { callbacks.onImageManager?.(); close() }}>
        <span class="menu-item-icon">🖼</span>
        <span class="menu-item-label">Image Manager</span>
      </div>
      <div class="menu-sep"></div>
      <div class="menu-item" @click=${() => { callbacks.onSave?.(); close() }}>
        <span class="menu-item-icon">💾</span>
        <span class="menu-item-label">Save as Zip</span>
      </div>
      <div class="menu-item" @click=${() => { callbacks.onLoad?.(); close() }}>
        <span class="menu-item-icon">📂</span>
        <span class="menu-item-label">Load from Zip</span>
      </div>
    </div>
  `

  render(tmpl, mountEl)

  mountEl.querySelector(`#${menuTriggerId}`)?.addEventListener("click", (e) => {
    document.getElementById(menuId)?.classList.toggle("open")
    e.stopPropagation()
  })

  document.addEventListener("click", (e) => {
    const menu = document.getElementById(menuId)
    if (!menu?.classList.contains("open")) return
    const target = e.target as HTMLElement
    if (!target.closest(`#${menuId}`) && !target.closest(`#${menuTriggerId}`)) {
      close()
    }
  })

  return {
    setProviderBadge(icon: string, label: string) {
      const iconEl = document.getElementById(menuProviderIconId)
      const labelEl = document.getElementById(menuProviderLabelId)
      if (iconEl) iconEl.textContent = icon
      if (labelEl) labelEl.textContent = label
    },
    setView(view: ViewType) {
      const editorBtn = document.getElementById(viewEditorId)
      const statsBtn = document.getElementById(viewStatsId)
      editorBtn?.classList.toggle("active", view === "editor")
      statsBtn?.classList.toggle("active", view === "disk-usage")
    },
  }
}
