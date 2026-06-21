import { Controller } from "@hotwired/stimulus";
import {
  Editor,
  rootCtx,
  defaultValueCtx,
  editorViewCtx,
  serializerCtx,
  prosePluginsCtx,
} from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { nord } from "@milkdown/theme-nord";
import { block } from "@milkdown/kit/plugin/block";
import { slashFactory } from "@milkdown/kit/plugin/slash";
import { EditorState, Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { parserCtx, remarkStringifyOptionsCtx } from "@milkdown/core";
import { clipboard } from "@milkdown/plugin-clipboard";
import { history } from "@milkdown/kit/plugin/history";
import { alertRemarkPlugin, alertSchema } from "../plugins/alert";
import { shortcodeDecoration } from "../plugins/shortcode";
import { confirmDialog } from "../components/dialogs/dialog";
import { mountTopbar, type TopbarAPI } from "../components/toolbar/topbar";
import {
  mountSidebar,
  type TreeNode,
  type SidebarActions,
} from "../components/panels/sidebar";
import {
  mountChangesDialog,
  type ChangesDialogData,
} from "../components/dialogs/changes-dialog";
import { mountPrefsDialog } from "../components/dialogs/prefs-dialog";
import { SlashView } from "../components/editor/editor-slash";
import { MentionView } from "../components/editor/editor-mention";
import {
  mountMetaPanel,
  type MetaPanelAPI,
  type MetaPanelData,
} from "../components/panels/meta-panel";
import type { Ctx } from "@milkdown/kit/ctx";

import { editorSelfBase } from "../config";
import { cache } from "../cache";
import { stripFrontmatter, serializeFrontmatter } from "../utils/frontmatter";
import { createPage } from "../editor-actions";
import { toggleSourceMode, applySourceContent } from "../editor-source";
import type { ContentProvider } from "../content/provider";
import { createProviderByType, type ProviderType } from "../content";
import { ViewManager, type ViewType } from "../components/views/view";
import { mountProviderDialog } from "../components/dialogs/provider-dialog";
import { mountDiskUsageView } from "../components/views/disk-usage-view";
import { registerEditorView } from "../components/views/editor-view";
import { showToast } from "../components/toast/toast";
import { exportToZip, importFromZip } from "../utils/zip";
import { loadPrefs } from "../storage";

const slash = slashFactory("predoc");

let mentionPlugin: Plugin | null = null;

let globalProvider: ContentProvider | null = null;
let sessionStarted = 0;

export function setProvider(provider: ContentProvider) {
  globalProvider = provider;
}

export function getProvider(): ContentProvider {
  if (!globalProvider) throw new Error("ContentProvider not initialized");
  return globalProvider;
}

export function setSessionStarted(time: number) {
  sessionStarted = time;
}

function cacheKeyForProvider(name: string): string {
  const map: Record<string, string> = {
    remote: "remote",
    fs: "filesystem",
    localStorage: "localStorage",
  };
  return map[name] || name;
}

function getProviderDisplayInfo(name: string): {
  icon: string;
  label: string;
  type: ProviderType;
} {
  const map: Record<
    string,
    { icon: string; label: string; type: ProviderType }
  > = {
    remote: { icon: "☁️", label: "Server (Remote)", type: "remote" },
    fs: { icon: "💻", label: "Local Files", type: "filesystem" },
    localStorage: {
      icon: "🗄️",
      label: "Browser Storage",
      type: "localStorage",
    },
  };
  return map[name] || { icon: "❓", label: name, type: name as ProviderType };
}

function updateDirtyCounter(topbar: TopbarAPI | null) {
  let totalBytes = 0;
  for (const path of cache.getDirtyPaths()) {
    totalBytes += cache.getBodyDelta(path);
  }
  const count = cache.getDirtyCount();
  topbar?.updateCounter(count, totalBytes);
  topbar?.setDirtyState(count > 0);
}

export default class extends Controller {
  declare milkdown: Editor | null;
  declare currentPath: string;
  declare sourceMode: boolean;
  declare topbar: TopbarAPI | null;
  declare metaPanel: MetaPanelAPI | null;
  declare loading: boolean;
  declare lastSetContent: Map<string, string>;
  declare editorStates: Map<string, EditorState>;
  declare viewManager: ViewManager;
  declare emptyTreePrompted: boolean;

  async connect() {
    const urlPath = window.location.pathname.slice(editorSelfBase.length).replace(/^\//, "") || "_index";
    this.currentPath = this.data.get("path") || urlPath;
    this.sourceMode = false;
    this.loading = false;
    this.lastSetContent = new Map();
    this.editorStates = new Map();
    this.emptyTreePrompted = false;

    const toolbarEl = document.getElementById("app-toolbar")!;

    this.topbar = mountTopbar(toolbarEl, () => this.milkdown, {
      onPrefs: () =>
        mountPrefsDialog({
          onStickyToolbarChange: (sticky) => {
            autoHidePref = sticky;
            if (!sticky) {
              const tb = document.querySelector(".app-toolbar");
              tb?.classList.remove("hidden");
              tb?.removeAttribute("style");
            }
          },
        }),
      onDirtyClick: () => this.handleDirtyClick(),
      onChangeProvider: () => this.handleChangeProvider(),
      onViewChange: (view: ViewType) => this.viewManager.switchTo(view),
      onSave: () => {
        exportToZip().then(() => this.loadSidebar());
      },
      onLoad: async () => {
        const count = await importFromZip();
        if (count === 0) return;
        cache.clearAll();
        cache.sync();
        await this.loadSidebar();
        const content = await this.fetchContent();
        await this.ensureEditor(content);
      },
    });

    const providerInfo = getProviderDisplayInfo(getProvider().name);
    this.topbar.setProviderBadge(providerInfo.icon, providerInfo.label);
    this.topbar.setProviderType(getProvider().name);

    const metaMount = document.getElementById("meta-panel-mount")!;
    this.metaPanel = mountMetaPanel(metaMount, (data) => {
      cache.setFrontmatter(this.currentPath, data);
      cache.addDirty(this.currentPath);
      cache.sync();
      updateDirtyCounter(this.topbar);
    });

    const prefs = loadPrefs();
    const toolbar = document.querySelector(
      ".app-toolbar",
    ) as HTMLElement | null;

    let autoHidePref = prefs.stickyToolbar;
    if (toolbar) {
      let lastScrollY = 0;
      const onScroll = () => {
        if (!autoHidePref) return;
        const sy =
          document.querySelector(".book-layout")?.scrollTop ?? window.scrollY;
        if (sy > 100 && sy > lastScrollY) {
          toolbar.style.top = "";
          toolbar.classList.add("hidden");
        } else if (sy < lastScrollY) {
          toolbar.style.top = sy + "px";
          toolbar.classList.remove("hidden");
        }
        lastScrollY = sy;
      };
      document.querySelector(".book-layout")?.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("scroll", onScroll, { passive: true });

      const editorEl = document.getElementById("milkdown-editor")!;
      const showOnEditorFocus = () => {
        const sy =
          document.querySelector(".book-layout")?.scrollTop ?? window.scrollY;
        toolbar.style.top = sy + "px";
        toolbar.classList.remove("hidden");
      }
      editorEl.addEventListener("focusin", showOnEditorFocus);
      editorEl.addEventListener("click", showOnEditorFocus);
    }

    window.addEventListener("popstate", () => {
      const target = window.location.pathname.slice(editorSelfBase.length).replace(/^\//, "") || "_index";
      this.doNavigate(target, false);
    });

    this.viewManager = new ViewManager();
    this.viewManager.onViewChange((view) => this.topbar?.setView(view));
    registerEditorView(this.viewManager.register.bind(this.viewManager), {
      sourceMode: () => this.sourceMode,
    });
    this.setupDiskUsageView();

    const content = await this.fetchContent();
    await this.ensureEditor(content);
    await this.loadSidebar();
    updateDirtyCounter(this.topbar);
  }

  private setupDiskUsageView() {
    const editorArea = document.getElementById("editor-area")!;
    const milkdownEl = document.getElementById("milkdown-editor")!;
    const sourceEl = document.getElementById("source-editor")!;

    this.viewManager.register("disk-usage", {
      activate: () => {
        milkdownEl.style.display = "none";
        sourceEl.style.display = "none";
        this.showDiskUsage();
      },
      deactivate: () => {
        const du = editorArea.querySelector(".disk-usage-wrapper");
        if (du) du.remove();
      },
    });
  }

  private topbarViewUpdate(view: ViewType) {
    this.topbar?.setView(view);
  }

  private showDiskUsage() {
    const provider = getProvider();
    const self = this;
    provider?.getTree().then(async (tree) => {
      if (self.viewManager.getCurrent() !== "disk-usage") return;

      const fileSizes = new Map<string, number>();
      const lastModified = new Map<string, number>();

      const leaves = collectLeaves(tree);
      for (const leaf of leaves) {
        const existing = cache.getBody(leaf) || cache.getBaseline(leaf);
        if (existing) {
          fileSizes.set(leaf, existing.length);
        } else {
          try {
            const content = await provider?.readFile(leaf);
            if (content && self.viewManager.getCurrent() === "disk-usage") {
              const { body } = stripFrontmatter(content);
              fileSizes.set(leaf, body.length);
            }
          } catch {}
        }
        const st = cache.getServerTime(leaf);
        if (st) lastModified.set(leaf, st);
      }

      const editorArea = document.getElementById("editor-area")!;
      if (self.viewManager.getCurrent() !== "disk-usage") return;

      mountDiskUsageView(
        editorArea,
        {
          tree,
          fileSizes,
          lastModified,
          providerName: getProviderDisplayInfo(provider.name).label,
          sessionStarted,
        },
        () => self.viewManager.switchTo("editor"),
      );
    });
  }

  async ensureEditor(content: string) {
    const self = this;

    if (this.milkdown) {
      const cached = this.editorStates.get(this.currentPath);
      if (cached) {
        this.lastSetContent.set(this.currentPath, "");
        this.milkdown.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          view.updateState(cached);
        });
      } else {
        this.lastSetContent.set(this.currentPath, "");
        this.milkdown.action((ctx) => {
          const parser = ctx.get(parserCtx);
          const view = ctx.get(editorViewCtx);
          const doc = parser(content);
          const newState = EditorState.create({
            schema: view.state.schema,
            doc,
            plugins: view.state.plugins,
          });
          view.updateState(newState);
          this.editorStates.set(this.currentPath, newState);
        });
      }
      updateDirtyCounter(this.topbar);
      return;
    }

    const editorEl = document.getElementById("milkdown-editor")!;

    this.milkdown = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, editorEl);
        ctx.set(defaultValueCtx, content);
        ctx.set(slash.key, { view: (v: any) => new SlashView(v, ctx) });
        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          handlers: {
            ...prev.handlers,
            text: (node: any, _: any, state: any, info: any) => {
              const value = node.value || "";
              if (/^[^*_\\]*\s+$/.test(value)) return value;
              if (value.includes("{{")) return value;
              return state.safe(value, { ...info, encode: [] });
            },
          },
        }));
        ctx.update(prosePluginsCtx, (plugins) => {
          const dirtyPlugin = new Plugin({
            key: new PluginKey("predoc-dirty"),
            view: () => ({
              update: (view, prevState) => {
                if (!prevState) return;
                const prevLastSet =
                  self.lastSetContent.get(self.currentPath) ?? "";
                if (prevLastSet === "") {
                  const serializer = ctx.get(serializerCtx);
                  self.lastSetContent.set(
                    self.currentPath,
                    serializer(view.state.doc).replace(/\r\n/g, "\n").replace(/\n+$/, "\n"),
                  );
                  return;
                }
                if (view.state.doc.eq(prevState.doc)) return;
                const serializer = ctx.get(serializerCtx);
                const md = serializer(view.state.doc).replace(/\r\n/g, "\n").replace(/\n+$/, "\n");
                if (md === prevLastSet) return;
                self.lastSetContent.set(self.currentPath, md);
                cache.setBody(self.currentPath, md);
                cache.sync();
                updateDirtyCounter(self.topbar);
              },
            }),
          });
          mentionPlugin = new Plugin({
            key: new PluginKey("predoc-mention"),
            view: (v) => new MentionView(v, ctx),
          });
          return plugins.concat(dirtyPlugin, mentionPlugin);
        });
      })
      .use(nord as any)
      .use(commonmark)
      .use(gfm)
      .use(block)
      .use(slash)
      .use(history)
      .use(clipboard)
      .use(alertRemarkPlugin)
      .use(alertSchema)
      .use(shortcodeDecoration)
      .create();

    this.milkdown.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.dispatch(view.state.tr);
      this.editorStates.set(this.currentPath, view.state);
    });
    updateDirtyCounter(this.topbar);
  }

  async fetchContent(): Promise<string> {
    try {
      const provider = getProvider();
      const raw = await provider?.readFile(this.currentPath);
      if (!raw) return "# New Page\n\nStart writing...";
      const { frontmatter, body } = stripFrontmatter(raw);
      const serverTime = await provider?.getServerTime(this.currentPath);
      const cachedTime = cache.getServerTime(this.currentPath) || 0;
      if (serverTime && serverTime > cachedTime) {
        cache.clearPath(this.currentPath);
        cache.setBaseline(this.currentPath, body);
        cache.setServerTime(this.currentPath, serverTime);
        if (frontmatter) {
          cache.setFrontmatter(this.currentPath, frontmatter);
          this.metaPanel?.update(frontmatter);
        }
        return body;
      }
      if (frontmatter) {
        if (
          cache.isDirty(this.currentPath) &&
          cache.getFrontmatter(this.currentPath)
        ) {
          this.metaPanel?.update(cache.getFrontmatter(this.currentPath)!);
        } else {
          cache.setFrontmatter(this.currentPath, frontmatter);
          this.metaPanel?.update(frontmatter);
        }
      } else {
        cache.removeFrontmatter(this.currentPath);
        this.metaPanel?.update({ title: "" });
      }
      cache.setBaseline(this.currentPath, body);
      return cache.getBody(this.currentPath) ?? body;
    } catch {
      return "# New Page\n\nStart writing...";
    }
  }

  async loadSidebar() {
    const sidebarEl = document.getElementById("sidebar-nav")!;
    try {
      const provider = getProvider();
      const sidebarCache: TreeNode = (await provider?.getTree()) ?? {};

      if (
        !this.emptyTreePrompted &&
        Object.keys(sidebarCache).length === 0 &&
        provider.name === "remote"
      ) {
        this.emptyTreePrompted = true;
        this.handleChangeProvider();
      }

      const actions: SidebarActions = {
        onNavigate: (path) => this.doNavigate(path, true),
        onNewPage: (parentPath) =>
          createPage(
            parentPath,
            (p) => this.doNavigate(p, true),
            () => this.loadSidebar(),
          ),
        onDelete: (path) => this.handleDeletePage(path),
        onRename: (path) => this.handleRenamePage(path),
        onMove: (from, to) => this.handleMovePage(from, to),
        onChangeProvider: () => this.handleChangeProvider(),
      };

      const pdi = getProviderDisplayInfo(provider.name);
      mountSidebar(
        sidebarEl,
        sidebarCache,
        this.currentPath,
        actions,
        pdi.icon,
        pdi.label,
      );
      this.attachNavListeners();
    } catch {}
  }

  private async handleChangeProvider() {
    const current = getProvider();
    const result = await mountProviderDialog(current.name);

    if (!result || result.type === current.name) return;

    cache.saveState(cacheKeyForProvider(current.name));
    cache.clearAll();
    cache.sync();

    const newProvider = createProviderByType(result.type);
    setProvider(newProvider);
    cache.restoreState(cacheKeyForProvider(result.type));

    const pdi = getProviderDisplayInfo(result.type);
    this.topbar?.setProviderBadge(pdi.icon, pdi.label);
    this.topbar?.setProviderType(result.type);

    this.editorStates.clear();

    await this.loadSidebar();
    const content = await this.fetchContent();
    await this.ensureEditor(content);

    showToast(`Switched to ${getProviderDisplayInfo(result.type).label}`);
  }

  private attachNavListeners() {
    document.querySelectorAll("[data-nav]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const link = el.getAttribute("data-nav")!;
        this.doNavigate(link, true);
      }),
    );
  }

  async doNavigate(path: string, pushHistory = true) {
    if (this.loading) return;
    this.loading = true;

    if (this.viewManager.getCurrent() !== "editor") {
      this.viewManager.switchTo("editor");
    }

    if (this.milkdown) {
      this.milkdown.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        this.editorStates.set(this.currentPath, view.state);
      });
    }

    this.currentPath = path;

    document.getElementById("source-editor")!.style.display = "none";
    document.getElementById("milkdown-editor")!.style.display = "block";
    this.sourceMode = false;

    if (pushHistory) {
      window.history.pushState(
        { path },
        "",
        `${editorSelfBase}${path === "_index" ? "" : path}`,
      );
    }

    const content = await this.fetchContent();
    await this.ensureEditor(content);
    await this.loadSidebar();
    updateDirtyCounter(this.topbar);
    this.loading = false;
  }

  private async handleDeletePage(pagePath: string) {
    const confirmed = await confirmDialog({
      title: "Delete page",
      message: `Are you sure you want to delete "${pagePath}"? This cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    const provider = getProvider();
    await provider?.deleteFile(pagePath);
    cache.clearPath(pagePath);
    cache.sync();
    updateDirtyCounter(this.topbar);

    if (this.currentPath === pagePath) {
      this.editorStates.delete(pagePath);
      this.doNavigate("_index", true);
    } else {
      this.editorStates.delete(pagePath);
      await this.loadSidebar();
    }
  }

  private async handleRenamePage(pagePath: string) {
    const name = prompt("New name:");
    if (!name) return;

    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (!slug) return;

    const parentDir = pagePath.includes("/")
      ? pagePath.substring(0, pagePath.lastIndexOf("/"))
      : "";
    const newPath = parentDir ? `${parentDir}/${slug}` : slug;

    const provider = getProvider();
    await provider?.moveFile(pagePath, newPath);

    cache.clearPath(pagePath);
    cache.sync();
    updateDirtyCounter(this.topbar);

    if (this.currentPath === pagePath) {
      this.editorStates.delete(pagePath);
      this.doNavigate(newPath, true);
    } else {
      this.editorStates.delete(pagePath);
      await this.loadSidebar();
    }
  }

  private async handleMovePage(from: string, to: string) {
    if (from === to) return;

    const provider = getProvider();
    await provider?.moveFile(from, to);

    cache.clearPath(from);
    cache.sync();
    updateDirtyCounter(this.topbar);

    if (this.currentPath === from) {
      this.editorStates.delete(from);
      this.doNavigate(to, false);
      window.history.replaceState(
        { path: to },
        "",
        `${editorSelfBase}${to === "_index" ? "" : to}`,
      );
    } else {
      this.editorStates.delete(from);
    }
    await this.loadSidebar();
  }

  async newPage(parentPath: string) {
    const name = prompt("Page name:");
    if (!name) return;

    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    if (!slug) return;

    const fullPath = parentPath ? `${parentPath}/${slug}` : slug;
    const fmData: MetaPanelData = { title: name, weight: 100 };
    const fmStr = serializeFrontmatter(fmData);
    const body = `# ${name}\n\n`;

    const provider = getProvider();
    const fullContent = `---\n${fmStr}\n---\n\n${body}`;
    await provider?.writeFile(fullPath, fullContent);

    cache.setFrontmatter(fullPath, fmData);
    await this.loadSidebar();
    this.doNavigate(fullPath, true);
  }

  toggleSource() {
    if (!this.milkdown) return;
    const sourceEl = document.getElementById("source-editor")!;
    const wysiwygEl = document.getElementById("milkdown-editor")!;
    this.sourceMode = toggleSourceMode(
      this.milkdown,
      sourceEl,
      wysiwygEl,
      this.sourceMode,
    );
  }

  async applySource() {
    const textarea = document.querySelector(
      "#source-editor textarea",
    ) as HTMLTextAreaElement;
    if (!textarea || !this.milkdown) return;

    this.lastSetContent.set(this.currentPath, "");
    applySourceContent(this.milkdown, textarea);

    const md = this.milkdown.action((ctx) => {
      const serializer = ctx.get(serializerCtx);
      return serializer(ctx.get(editorViewCtx).state.doc).replace(/\r\n/g, "\n").replace(/\n+$/, "\n");
    });
    cache.setBody(this.currentPath, md);
    updateDirtyCounter(this.topbar);

    this.sourceMode = false;
    document.getElementById("source-editor")!.style.display = "none";
    document.getElementById("milkdown-editor")!.style.display = "block";
  }

  async flush() {
    if (!this.milkdown) return;

    const dirtyPaths = cache.getDirtyPaths();
    if (dirtyPaths.length === 0) return;

    const currentMd = this.milkdown.action((ctx) => {
      const serializer = ctx.get(serializerCtx);
      return serializer(ctx.get(editorViewCtx).state.doc).replace(/\r\n/g, "\n").replace(/\n+$/, "\n");
    });

    const provider = getProvider();

    for (const path of dirtyPaths) {
      let body: string;
      if (path === this.currentPath) {
        body = currentMd;
      } else {
        const cached = cache.getBody(path);
        if (cached) {
          body = cached;
        } else {
          const cachedRaw = await provider?.readFile(path);
          if (!cachedRaw) continue;
          body = stripFrontmatter(cachedRaw).body;
        }
      }

      const fmData = cache.getFrontmatter(path);
      const fullContent = fmData
        ? `---\n${serializeFrontmatter(fmData)}\n---\n\n${body}`
        : body;

      if (path === this.currentPath) {
        const serverTime = cache.getServerTime(path);
        if (serverTime) {
          const fileTime = await provider?.getServerTime(path);
          if (fileTime && fileTime > serverTime) {
            if (!confirm(`"${path}" was modified on disk. Overwrite?`))
              continue;
          }
        }
      }

      try {
        await provider?.writeFile(path, fullContent);
        cache.deletePatch(path);
        cache.setBaseline(path, body);
        cache.cacheBody(path, body);
        const fileTime = await provider?.getServerTime(path);
        if (fileTime) {
          cache.setServerTime(path, fileTime);
        }
      } catch {}
    }

    cache.sync();
    updateDirtyCounter(this.topbar);
  }

  async discardFile(pagePath: string) {
    const confirmed = await confirmDialog({
      title: "Discard changes",
      message: `Discard unsaved changes to "${pagePath}"? This cannot be undone.`,
      confirmLabel: "Discard",
      confirmClass: "predoc-dialog-confirm",
    });
    if (!confirmed) return;

    cache.clearPath(pagePath);
    cache.sync();
    updateDirtyCounter(this.topbar);

    if (pagePath === this.currentPath) {
      this.editorStates.delete(pagePath);
      const provider = getProvider();
      const raw = (await provider?.readFile(pagePath)) || "";
      const { frontmatter, body } = stripFrontmatter(raw);
      if (frontmatter) cache.setFrontmatter(pagePath, frontmatter);
      cache.setBaseline(pagePath, body);
      await this.ensureEditor(body);
    }
  }

  async handleDirtyClick() {
    const dirtyPaths = cache.getDirtyPaths();
    if (dirtyPaths.length === 0) return;

    const provider = getProvider();
    const changes: ChangesDialogData[] = [];
    for (const path of dirtyPaths) {
      let md = cache.reconstructContent(path);

      if (!md && path === this.currentPath && this.milkdown) {
        md = this.milkdown.action((ctx) => {
          const serializer = ctx.get(serializerCtx);
          return serializer(ctx.get(editorViewCtx).state.doc).replace(/\r\n/g, "\n").replace(/\n+$/, "\n");
        });
      }

      if (!md) {
        const cachedRaw = await provider?.readFile(path);
        if (!cachedRaw) continue;
        const { body } = stripFrontmatter(cachedRaw);
        cache.setBaseline(path, body);
        md = cache.reconstructContent(path);
      }

      if (!md) continue;
      changes.push({
        path,
        currentPath: path === this.currentPath,
        md,
        changeSize: cache.getBodyDelta(path),
      });
    }

    mountChangesDialog(
      changes,
      this.currentPath,
      {
        onDiscard: (path) => {
          this.editorStates.delete(path);
          cache.clearPath(path);
          cache.sync();
          updateDirtyCounter(this.topbar);
          if (path === this.currentPath) {
            provider?.readFile(path).then((raw) => {
              const { frontmatter, body } = stripFrontmatter(raw || "");
              if (frontmatter) cache.setFrontmatter(path, frontmatter);
              cache.setBaseline(path, body);
              this.ensureEditor(body);
            });
          }
        },
        onNavigate: (path) => this.doNavigate(path, true),
        onReload: async (path) => {
          const raw = await provider?.readFile(path);
          return raw || "";
        },
        onFlushAll: () => this.flush(),
        onDiscardAll: async () => {
          const paths = cache.getDirtyPaths();
          for (const path of paths) {
            this.editorStates.delete(path);
            cache.clearPath(path);
          }
          cache.sync();
          updateDirtyCounter(this.topbar);
          if (paths.includes(this.currentPath)) {
            const raw = (await provider?.readFile(this.currentPath)) || "";
            const { frontmatter, body } = stripFrontmatter(raw);
            if (frontmatter)
              cache.setFrontmatter(this.currentPath, frontmatter);
            cache.setBaseline(this.currentPath, body);
            await this.ensureEditor(body);
          }
        },
      },
      () => {},
    );
  }
}

function collectLeaves(tree: TreeNode, prefix = ""): string[] {
  const leaves: string[] = [];
  for (const [key, val] of Object.entries(tree)) {
    const fullPath = prefix ? `${prefix}/${key}` : key;
    if (val === null || (typeof val === "object" && "weight" in val)) {
      leaves.push(fullPath.replace(/\.md$/, ""));
    } else if (typeof val === "object" && val !== null) {
      leaves.push(...collectLeaves(val as TreeNode, fullPath));
    }
  }
  return leaves;
}
