/**
 * EditorService
 * 
 * Manages Milkdown editor lifecycle, state, and configuration
 * Handles editor creation, content updates, and source/WYSIWYG mode switching
 */

import { Editor, rootCtx, defaultValueCtx, editorViewCtx, serializerCtx, prosePluginsCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { gfm } from "@milkdown/kit/preset/gfm";
import { nord } from "@milkdown/theme-nord";
import { EditorState, Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { parserCtx, remarkStringifyOptionsCtx } from "@milkdown/core";
import { clipboard } from "@milkdown/plugin-clipboard";
import { history } from "@milkdown/kit/plugin/history";
import { linkTooltipPlugin, configureLinkTooltip, linkTooltipConfig } from "@milkdown/kit/component/link-tooltip";
import { cursor, dropIndicatorConfig } from "@milkdown/kit/plugin/cursor";
import { $prose } from "@milkdown/kit/utils";
import { createKeymap } from "../keyboard";
import { copyIcon, editIcon, removeIcon, confirmIcon } from "../components/icons";
import { alertRemarkPlugin, alertSchema } from "../plugins/alert";
import { shortcodeDecoration } from "../plugins/shortcode";
import { hugoRefSchema, initHugoRefClicks } from "../plugins/hugo-ref";
import { MentionView } from "../components/editor/editor-mention";
import { configureBlockEdit, block, slash, menuAPI } from "../features/block-edit";
import { cache } from "../cache";
import { toggleSourceMode, applySourceContent } from "../editor-source";
import { getProvider } from "../content/provider-registry";
import { stripFrontmatter } from "../utils/frontmatter";

export interface EditorServiceConfig {
  onContentChange?: (content: string) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export class EditorService {
  private editor: Editor | null = null;
  private editorStates: Map<string, EditorState> = new Map();
  private lastSetContent: Map<string, string> = new Map();
  private mentionView: MentionView | null = null;
  private currentPath: string = "";
  private sourceMode: boolean = false;
  private config: EditorServiceConfig;

  constructor(config: EditorServiceConfig = {}) {
    this.config = config;
  }

  /**
   * Set current path context
   */
  setCurrentPath(path: string): void {
    this.currentPath = path;
  }

  /**
   * Get current editor instance
   */
  getEditor(): Editor | null {
    return this.editor;
  }

  /**
   * Get mention view for page suggestions
   */
  getMentionView(): MentionView | null {
    return this.mentionView;
  }

  isSourceMode(): boolean {
    return this.sourceMode;
  }

  /**
   * Ensure editor exists and update content
   */
  ensureEditor(content: string): Promise<void> {
    if (!content || !content.trim()) {
      content = "# New Page\n\nStart writing...";
    }
    if (this.editor) {
      return Promise.resolve(this.updateEditorContent(content));
    }

    const editorEl = document.getElementById("milkdown-editor");
    if (!editorEl) throw new Error("Editor container not found");

    return this.createEditor(editorEl, content).then((e) => {
      this.editor = e;
    });
  }

  async fetchContent(path: string, onMetaUpdate?: (data: any) => void): Promise<string> {
    try {
      const provider = getProvider();
      const raw = await provider?.readFile(path);
      if (!raw) return "# New Page\n\nStart writing...";

      const { frontmatter, body } = stripFrontmatter(raw);
      const serverTime = await provider?.getServerTime(path);
      const cachedTime = cache.getServerTime(path) || 0;

      if (serverTime && serverTime > cachedTime) {
        cache.clearPath(path);
        cache.setBaseline(path, body);
        cache.setServerTime(path, serverTime);
        if (frontmatter) onMetaUpdate?.(frontmatter);
        return body;
      }

      if (frontmatter) {
        if (cache.isDirty(path) && cache.getFrontmatter(path)) {
          onMetaUpdate?.(cache.getFrontmatter(path)!);
        } else {
          cache.setFrontmatter(path, frontmatter);
          onMetaUpdate?.(frontmatter);
        }
      } else {
        cache.removeFrontmatter(path);
        onMetaUpdate?.({ title: "" });
      }
      cache.setBaseline(path, body);
      return cache.getBody(path) ?? body;
    } catch {
      return "# New Page\n\nStart writing...";
    }
  }

  async loadContent(path: string, onMetaUpdate?: (data: any) => void): Promise<void> {
    const content = await this.fetchContent(path, onMetaUpdate);
    return this.ensureEditor(content);
  }

  /**
   * Update existing editor content
   */
  private updateEditorContent(content: string): void {
    if (!this.editor) return;

    const cached = this.editorStates.get(this.currentPath);
    if (cached) {
      this.lastSetContent.set(this.currentPath, "");
      this.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.updateState(cached);
      });
    } else {
      this.lastSetContent.set(this.currentPath, "");
      this.editor.action((ctx) => {
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
  }

  /**
   * Create new Milkdown editor instance
   */
  private async createEditor(container: HTMLElement, content: string): Promise<Editor> {
    const self = this;

    const editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container);
        ctx.set(defaultValueCtx, content);
        configureBlockEdit(ctx);

        ctx.update(dropIndicatorConfig.key, () => ({
          class: "predoc-drop-cursor",
          width: 4,
          color: false,
        }));

        ctx.update(remarkStringifyOptionsCtx, (prev) => ({
          ...prev,
          handlers: {
            ...prev.handlers,
            text: (node: any, _: any, state: any, info: any) => {
              const value = node.value;
              if (!value) return "";
              if (/^[^*_\\]*\s+$/.test(value)) return value;
              if (value.includes("{{")) return value;
              return state.safe(value, { ...info, encode: [] });
            },
          },
        }));

        configureLinkTooltip(ctx);
        ctx.update(linkTooltipConfig.key, (prev) => ({
          ...prev,
          linkIcon: copyIcon,
          editButton: editIcon,
          removeButton: removeIcon,
          confirmButton: confirmIcon,
          inputPlaceholder: "Paste link...",
        }));

        ctx.update(prosePluginsCtx, (plugins) => {
          const dirtyPlugin = new Plugin({
            key: new PluginKey("predoc-dirty"),
            view: () => ({
              update: (view, prevState) => {
                if (!prevState) return;
                const prevLastSet = self.lastSetContent.get(self.currentPath) ?? "";
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
                self.config.onDirtyChange?.(true);
              },
            }),
          });

          const mentionPlugin = new Plugin({
            key: new PluginKey("predoc-mention"),
            view: (v) => {
              const mv = new MentionView(v, ctx);
              self.mentionView = mv;
              return mv;
            },
          });

          return plugins.concat(dirtyPlugin, mentionPlugin, createKeymap());
        });
      })
      .use(nord as any)
      .use(commonmark)
      .use(gfm)
      .use(block)
      .use(slash)
      .use(menuAPI)
      .use(history)
      .use(clipboard)
      .use(alertRemarkPlugin)
      .use(alertSchema)
      .use(hugoRefSchema)
      .use(shortcodeDecoration)
      .use(linkTooltipPlugin)
      .use(cursor)
      .use($prose(() => {
        const dragDropPlugin = new Plugin({
          key: new PluginKey("predoc-drag-drop"),
          props: {
            handleDOMEvents: {
              dragstart(view, event) {
                if (view.dragging?.move) {
                  const { selection, doc } = view.state;
                  const $from = doc.resolve(selection.from);
                  const from = $from.before($from.depth);
                  const to = from + $from.node($from.depth).nodeSize;
                  
                  (view.dragging as any).node = {
                    replace: (tr: any) => {
                      const mappedFrom = tr.mapping.map(from);
                      const mappedTo = tr.mapping.map(to);
                      tr.delete(mappedFrom, mappedTo);
                    },
                  };
                }
                return false;
              },
            },
          },
        });
        return dragDropPlugin;
      }))
      .create();

    editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      initHugoRefClicks(view);
    });

    return editor;
  }

  /**
   * Toggle between source and WYSIWYG mode
   */
  toggleSourceMode(): boolean {
    if (!this.editor) return this.sourceMode;

    const sourceEl = document.getElementById("source-editor");
    const wysiwygEl = document.getElementById("milkdown-editor");

    if (!sourceEl || !wysiwygEl) return this.sourceMode;

    this.sourceMode = toggleSourceMode(this.editor, sourceEl, wysiwygEl, this.sourceMode);
    return this.sourceMode;
  }

  /**
   * Apply source editor content back to WYSIWYG
   */
  async applySourceContent(): Promise<void> {
    if (!this.editor) return;

    const textarea = document.querySelector("#source-editor textarea") as HTMLTextAreaElement;
    if (!textarea) return;

    this.lastSetContent.set(this.currentPath, "");
    applySourceContent(this.editor, textarea);

    const md = this.editor.action((ctx) => {
      const serializer = ctx.get(serializerCtx);
      return serializer(ctx.get(editorViewCtx).state.doc).replace(/\r\n/g, "\n").replace(/\n+$/, "\n");
    });

    cache.setBody(this.currentPath, md);
    this.sourceMode = false;

    const sourceEl = document.getElementById("source-editor");
    const wysiwygEl = document.getElementById("milkdown-editor");
    if (sourceEl && wysiwygEl) {
      sourceEl.style.display = "none";
      wysiwygEl.style.display = "block";
    }

    this.config.onContentChange?.(md);
  }

  /**
   * Get current editor content
   */
  getCurrentContent(): string {
    if (!this.editor) return "";

    return this.editor.action((ctx) => {
      const serializer = ctx.get(serializerCtx);
      return serializer(ctx.get(editorViewCtx).state.doc).replace(/\r\n/g, "\n").replace(/\n+$/, "\n");
    });
  }

  /**
   * Save current editor state for path
   */
  saveState(path: string): void {
    if (!this.editor) return;

    this.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      this.editorStates.set(path, view.state);
    });
  }

  /**
   * Clear saved states
   */
  clearStates(): void {
    this.editorStates.clear();
    this.lastSetContent.clear();
  }

  /**
   * Clear last set content for a path (resets dirty tracking)
   */
  clearLastSetContent(path: string): void {
    this.lastSetContent.set(path, "");
  }

  /**
   * Cleanup editor
   */
  destroy(): void {
    this.editor = null;
    this.mentionView = null;
    this.clearStates();
  }
}
