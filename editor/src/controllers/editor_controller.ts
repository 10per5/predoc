import { Controller } from "@hotwired/stimulus"
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  serializerCtx,
  prosePluginsCtx,
} from "@milkdown/kit/core"
import { commonmark } from "@milkdown/kit/preset/commonmark"
import { gfm } from "@milkdown/kit/preset/gfm"
import { nord } from "@milkdown/theme-nord"
import { block } from "@milkdown/kit/plugin/block"
import { slashFactory } from "@milkdown/kit/plugin/slash"
import { EditorState, Plugin, PluginKey } from "@milkdown/kit/prose/state"
import { parserCtx } from "@milkdown/core"
import { history } from "@milkdown/kit/plugin/history"
import { confirmDialog } from "../components/dialogs/dialog"
import { mountTopbar, type TopbarAPI } from "../components/toolbar/topbar"
import { mountSidebar, type TreeNode, type SidebarActions } from "../components/panels/sidebar"
import { loadPrefs } from "../storage"
import { mountChangesDialog, type ChangesDialogData } from "../components/dialogs/changes-dialog"
import { mountPrefsDialog } from "../components/dialogs/prefs-dialog"
import { SlashView } from "../components/editor/editor-slash"
import { MentionView } from "../components/editor/editor-mention"
import { mountMetaPanel, type MetaPanelAPI, type MetaPanelData } from "../components/panels/meta-panel"
import type { Ctx } from "@milkdown/kit/ctx"

import { cache } from "../cache"
import { normalizeMd } from "../utils/text"
import { stripFrontmatter, serializeFrontmatter } from "../utils/frontmatter"
import { createPage, deletePage, renamePage, movePage } from "../editor-actions"
import {
  toggleSourceMode,
  applySourceContent,
} from "../editor-source"

const slash = slashFactory("predoc")

let mentionPlugin: Plugin | null = null

function updateDirtyCounter(topbar: TopbarAPI | null) {
  let totalBytes = 0
  for (const path of cache.getDirtyPaths()) {
    totalBytes += cache.getBodyDelta(path)
  }
  const count = cache.getDirtyCount()
  topbar?.updateCounter(count, totalBytes)
  topbar?.setDirtyState(count > 0)
}

export default class extends Controller {
  declare milkdown: Editor | null
  declare currentPath: string
  declare sourceMode: boolean
  declare topbar: TopbarAPI | null
  declare metaPanel: MetaPanelAPI | null
  declare loading: boolean
  declare lastSetContent: Map<string, string>
  declare editorStates: Map<string, EditorState>

  async connect() {
    const urlPath = window.location.pathname.replace(/^\//, "") || "_index"
    this.currentPath = this.data.get("path") || urlPath
    this.sourceMode = false
    this.loading = false
    this.lastSetContent = new Map()
    this.editorStates = new Map()

    const topbarMount = document.getElementById("editor-area")!
    this.topbar = mountTopbar(topbarMount, () => this.milkdown, {
      onPrefs: () =>
        mountPrefsDialog({
          onStickyToolbarChange: (sticky) => {
            document.querySelector(".editor-toolbar")?.classList.toggle("sticky", sticky)
          },
        }),
      onDirtyClick: () => this.handleDirtyClick(),
    })

    const metaMount = document.getElementById("meta-panel-mount")!
    this.metaPanel = mountMetaPanel(metaMount, (data) => {
      cache.setFrontmatter(this.currentPath, data)
      cache.addDirty(this.currentPath)
      cache.sync()
      updateDirtyCounter(this.topbar)
    })

    window.addEventListener("popstate", () => {
      const target = window.location.pathname.replace(/^\//, "") || "_index"
      this.doNavigate(target, false)
    })

    const prefs = loadPrefs()
    if (prefs.stickyToolbar) {
      document.querySelector(".editor-toolbar")?.classList.add("sticky")
    }

    const content = await this.fetchContent()
    await this.ensureEditor(content)
    await this.loadSidebar()
    updateDirtyCounter(this.topbar)
  }

  async ensureEditor(content: string) {
    const self = this

    if (this.milkdown) {
      const cached = this.editorStates.get(this.currentPath)
      if (cached) {
        this.lastSetContent.set(this.currentPath, "")
        this.milkdown.action((ctx) => {
          const view = ctx.get(editorViewCtx)
          view.updateState(cached)
        })
      } else {
        this.lastSetContent.set(this.currentPath, "")
        this.milkdown.action((ctx) => {
          const parser = ctx.get(parserCtx)
          const view = ctx.get(editorViewCtx)
          const doc = parser(content)
          const newState = EditorState.create({
            schema: view.state.schema,
            doc,
            plugins: view.state.plugins,
          })
          view.updateState(newState)
          this.editorStates.set(this.currentPath, newState)
        })
      }
      updateDirtyCounter(this.topbar)
      return
    }

    const editorEl = document.getElementById("milkdown-editor")!

    this.milkdown = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, editorEl)
        ctx.set(defaultValueCtx, content)
        ctx.set(slash.key, { view: (v: any) => new SlashView(v, ctx) })
        ctx.update(prosePluginsCtx, (plugins) => {
          const dirtyPlugin = new Plugin({
            key: new PluginKey("predoc-dirty"),
            view: () => ({
              update: (view, prevState) => {
                if (!prevState) return
                const prevLastSet = self.lastSetContent.get(self.currentPath) ?? ""
                if (prevLastSet === "") {
                  const serializer = ctx.get(serializerCtx)
                  self.lastSetContent.set(self.currentPath, normalizeMd(serializer(view.state.doc)))
                  return
                }
                if (view.state.doc.eq(prevState.doc)) return
                const serializer = ctx.get(serializerCtx)
                const md = normalizeMd(serializer(view.state.doc))
                if (md === prevLastSet) return
                self.lastSetContent.set(self.currentPath, md)
                cache.setBody(self.currentPath, md)
                cache.sync()
                updateDirtyCounter(self.topbar)
              },
            }),
          })
          mentionPlugin = new Plugin({
            key: new PluginKey("predoc-mention"),
            view: (v) => new MentionView(v, ctx),
          })
          return plugins.concat(dirtyPlugin, mentionPlugin)
        })
      })
      .use(nord as any)
      .use(commonmark)
      .use(gfm)
      .use(block)
      .use(slash)
      .use(history)
      .create()

    this.milkdown.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      view.dispatch(view.state.tr)
      this.editorStates.set(this.currentPath, view.state)
    })
    updateDirtyCounter(this.topbar)
  }

  async fetchContent(): Promise<string> {
    try {
      const res = await fetch(`/content/${this.currentPath}.md`)
      if (!res.ok) return "# New Page\n\nStart writing..."
      const raw = await res.text()
      const { frontmatter, body } = stripFrontmatter(raw)
      const lastModified = res.headers.get("Last-Modified")
      if (lastModified) {
        cache.setServerTime(this.currentPath, new Date(lastModified).getTime())
      }
      if (frontmatter) {
        if (cache.isDirty(this.currentPath) && cache.getFrontmatter(this.currentPath)) {
          this.metaPanel?.update(cache.getFrontmatter(this.currentPath)!)
        } else {
          cache.setFrontmatter(this.currentPath, frontmatter)
          this.metaPanel?.update(frontmatter)
        }
      } else {
        cache.removeFrontmatter(this.currentPath)
        this.metaPanel?.update({ title: "" })
      }
      cache.setBaseline(this.currentPath, body)
      return cache.getBody(this.currentPath) ?? body
    } catch {
      return "# New Page\n\nStart writing..."
    }
  }

  async loadSidebar() {
    const sidebarEl = document.getElementById("sidebar-nav")!
    try {
      const res = await fetch("/api/tree")
      if (!res.ok) return
      const sidebarCache: TreeNode = await res.json()

      const actions: SidebarActions = {
        onNavigate: (path) => this.doNavigate(path, true),
        onNewPage: (parentPath) => createPage(parentPath, (p) => this.doNavigate(p, true), () => this.loadSidebar()),
        onDelete: (path) => this.handleDeletePage(path),
        onRename: (path) => this.handleRenamePage(path),
        onMove: (from, to) => this.handleMovePage(from, to),
      }

      mountSidebar(sidebarEl, sidebarCache, this.currentPath, actions)
      this.attachNavListeners()
    } catch {}
  }

  private attachNavListeners() {
    document.querySelectorAll("[data-nav]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault()
        const link = el.getAttribute("data-nav")!
        this.doNavigate(link, true)
      })
    )
  }

  async doNavigate(path: string, pushHistory = true) {
    if (this.loading) return
    this.loading = true

    if (this.milkdown) {
      this.milkdown.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        this.editorStates.set(this.currentPath, view.state)
      })
    }

    this.currentPath = path

    document.getElementById("source-editor")!.style.display = "none"
    document.getElementById("milkdown-editor")!.style.display = "block"
    this.sourceMode = false

    if (pushHistory) {
      window.history.pushState({ path }, "", `/${path === "_index" ? "" : path}`)
    }

    const content = await this.fetchContent()
    await this.ensureEditor(content)
    await this.loadSidebar()
    updateDirtyCounter(this.topbar)
    this.loading = false
  }

  private async handleDeletePage(pagePath: string) {
    const confirmed = await confirmDialog({
      title: "Delete page",
      message: `Are you sure you want to delete "${pagePath}"? This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    })
    if (!confirmed) return

    await fetch(`/content/${pagePath}.md`, { method: "DELETE" })
    cache.clearPath(pagePath)
    cache.sync()
    updateDirtyCounter(this.topbar)

    if (this.currentPath === pagePath) {
      this.editorStates.delete(pagePath)
      this.doNavigate("_index", true)
    } else {
      this.editorStates.delete(pagePath)
      await this.loadSidebar()
    }
  }

  private async handleRenamePage(pagePath: string) {
    const name = prompt("New name:")
    if (!name) return

    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
    if (!slug) return

    const parentDir = pagePath.includes("/")
      ? pagePath.substring(0, pagePath.lastIndexOf("/"))
      : ""
    const newPath = parentDir ? `${parentDir}/${slug}` : slug

    const res = await fetch("/api/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${pagePath}.md`, to: `${newPath}.md` }),
    })
    if (!res.ok) return

    cache.clearPath(pagePath)
    cache.sync()
    updateDirtyCounter(this.topbar)

    if (this.currentPath === pagePath) {
      this.editorStates.delete(pagePath)
      this.doNavigate(newPath, true)
    } else {
      this.editorStates.delete(pagePath)
      await this.loadSidebar()
    }
  }

  private async handleMovePage(from: string, to: string) {
    if (from === to) return

    const res = await fetch("/api/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${from}.md`, to: `${to}.md` }),
    })
    if (!res.ok) return

    cache.clearPath(from)
    cache.sync()
    updateDirtyCounter(this.topbar)

    if (this.currentPath === from) {
      this.editorStates.delete(from)
      this.doNavigate(to, false)
      window.history.replaceState({ path: to }, "", `/${to === "_index" ? "" : to}`)
    } else {
      this.editorStates.delete(from)
    }
    await this.loadSidebar()
  }

  async newPage(parentPath: string) {
    const name = prompt("Page name:")
    if (!name) return

    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
    if (!slug) return

    const fullPath = parentPath ? `${parentPath}/${slug}` : slug
    const fmData: MetaPanelData = { title: name, weight: 100 }
    const fmStr = serializeFrontmatter(fmData)
    const body = `# ${name}\n\n`

    await fetch(`/content/${fullPath}.md`, {
      method: "PUT",
      headers: { "Content-Type": "text/markdown" },
      body: `---\n${fmStr}\n---\n\n${body}`,
    })

    cache.setFrontmatter(fullPath, fmData)
    await this.loadSidebar()
    this.doNavigate(fullPath, true)
  }

  toggleSource() {
    if (!this.milkdown) return
    const sourceEl = document.getElementById("source-editor")!
    const wysiwygEl = document.getElementById("milkdown-editor")!
    this.sourceMode = toggleSourceMode(this.milkdown, sourceEl, wysiwygEl, this.sourceMode)
  }

  async applySource() {
    const textarea = document.querySelector("#source-editor textarea") as HTMLTextAreaElement
    if (!textarea || !this.milkdown) return

    this.lastSetContent.set(this.currentPath, "")
    applySourceContent(this.milkdown, textarea)

    const md = this.milkdown.action((ctx) => {
      const serializer = ctx.get(serializerCtx)
      return normalizeMd(serializer(ctx.get(editorViewCtx).state.doc))
    })
    cache.setBody(this.currentPath, md)
    updateDirtyCounter(this.topbar)

    this.sourceMode = false
    document.getElementById("source-editor")!.style.display = "none"
    document.getElementById("milkdown-editor")!.style.display = "block"
  }

  async flush() {
    if (!this.milkdown) return

    const dirtyPaths = cache.getDirtyPaths()
    if (dirtyPaths.length === 0) return

    const currentMd = this.milkdown.action((ctx) => {
      const serializer = ctx.get(serializerCtx)
      return normalizeMd(serializer(ctx.get(editorViewCtx).state.doc))
    })

    for (const path of dirtyPaths) {
      let body: string
      if (path === this.currentPath) {
        body = currentMd
      } else {
        const cached = cache.getBody(path)
        if (cached) {
          body = cached
        } else {
          try {
            const res = await fetch(`/content/${path}.md`)
            if (!res.ok) continue
            const raw = await res.text()
            body = stripFrontmatter(raw).body
          } catch { continue }
        }
      }

      const fmData = cache.getFrontmatter(path)
      const fullContent = fmData
        ? `---\n${serializeFrontmatter(fmData)}\n---\n\n${body}`
        : body

      if (path === this.currentPath) {
        const serverTime = cache.getServerTime(path)
        if (serverTime) {
          try {
            const head = await fetch(`/content/${path}.md`, { method: "HEAD" })
            const lastModified = head.headers.get("Last-Modified")
            if (lastModified && new Date(lastModified).getTime() > serverTime) {
              if (!confirm(`"${path}" was modified on disk. Overwrite?`)) continue
            }
          } catch {}
        }
      }

      try {
        const res = await fetch(`/content/${path}.md`, {
          method: "PUT",
          headers: { "Content-Type": "text/markdown" },
          body: fullContent,
        })
        cache.deletePatch(path)
        cache.setBaseline(path, body)
        cache.cacheBody(path, body)
        const lastModified = res.headers.get("Last-Modified")
        if (lastModified) {
          cache.setServerTime(path, new Date(lastModified).getTime())
        }
      } catch {}
    }

    cache.sync()
    updateDirtyCounter(this.topbar)
  }

  async discardFile(pagePath: string) {
    const confirmed = await confirmDialog({
      title: "Discard changes",
      message: `Discard unsaved changes to "${pagePath}"? This cannot be undone.`,
      confirmLabel: "Discard",
      confirmClass: "predoc-dialog-confirm",
    })
    if (!confirmed) return

    cache.clearPath(pagePath)
    cache.sync()
    updateDirtyCounter(this.topbar)

    if (pagePath === this.currentPath) {
      this.editorStates.delete(pagePath)
      const res = await fetch(`/content/${pagePath}.md`)
      const raw = res.ok ? await res.text() : ""
      const { frontmatter, body } = stripFrontmatter(raw)
      if (frontmatter) cache.setFrontmatter(pagePath, frontmatter)
      cache.setBaseline(pagePath, body)
      await this.ensureEditor(body)
    }
  }

  async handleDirtyClick() {
    const dirtyPaths = cache.getDirtyPaths()
    if (dirtyPaths.length === 0) return

    const changes: ChangesDialogData[] = []
    for (const path of dirtyPaths) {
      let md = cache.reconstructContent(path)

      if (!md && path === this.currentPath && this.milkdown) {
        md = this.milkdown.action((ctx) => {
          const serializer = ctx.get(serializerCtx)
          return normalizeMd(serializer(ctx.get(editorViewCtx).state.doc))
        })
      }

      if (!md) {
        try {
          const res = await fetch(`/content/${path}.md`)
          if (!res.ok) continue
          const raw = await res.text()
          const { body } = stripFrontmatter(raw)
          cache.setBaseline(path, body)
          md = cache.reconstructContent(path)
        } catch { continue }
      }

      if (!md) continue
      changes.push({ path, currentPath: path === this.currentPath, md, changeSize: cache.getBodyDelta(path) })
    }

    mountChangesDialog(
      changes,
      this.currentPath,
      {
        onDiscard: (path) => {
          this.editorStates.delete(path)
          cache.clearPath(path)
          cache.sync()
          updateDirtyCounter(this.topbar)
          if (path === this.currentPath) {
            fetch(`/content/${path}.md`).then(res => {
              if (res.ok) return res.text()
              return ""
            }).then(raw => {
              const { frontmatter, body } = stripFrontmatter(raw)
              if (frontmatter) cache.setFrontmatter(path, frontmatter)
              cache.setBaseline(path, body)
              this.ensureEditor(body)
            })
          }
        },
        onNavigate: (path) => this.doNavigate(path, true),
        onReload: async (path) => {
          try {
            const res = await fetch(`/content/${path}.md`)
            return res.ok ? res.text() : ""
          } catch {
            return ""
          }
        },
        onFlushAll: () => this.flush(),
        onDiscardAll: async () => {
          const paths = cache.getDirtyPaths()
          for (const path of paths) {
            this.editorStates.delete(path)
            cache.clearPath(path)
          }
          cache.sync()
          updateDirtyCounter(this.topbar)
          if (paths.includes(this.currentPath)) {
            try {
              const res = await fetch(`/content/${this.currentPath}.md`)
              const raw = res.ok ? await res.text() : ""
              const { frontmatter, body } = stripFrontmatter(raw)
              if (frontmatter) cache.setFrontmatter(this.currentPath, frontmatter)
              cache.setBaseline(this.currentPath, body)
              await this.ensureEditor(body)
            } catch {}
          }
        },
      },
      () => {}
    )
  }
}