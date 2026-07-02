/**
 * ViewManagementService
 * 
 * Manages view switching and disk usage view rendering
 * Handles view registration and lifecycle
 */

import { stripFrontmatter } from "../utils/frontmatter";
import { mountDiskUsageView } from "../components/views/disk-usage-view";
import { ViewManager, type ViewType } from "../components/views/view-manager";
import { registerEditorView } from "../components/views/editor-view";
import { cache } from "../stores/cache";
import { getProvider, getProviderDisplayInfo } from "../providers/provider-registry";
import { collectLeaves } from "../utils/tree";

export interface ViewCallbacks {
  onViewChanged?: (view: ViewType) => void;
  onSourceMode?: () => boolean;
}

export class ViewManagementService {
  private viewManager: ViewManager;
  private callbacks: ViewCallbacks;
  private sessionStarted: number;

  constructor(callbacks: ViewCallbacks = {}, sessionStarted: number = 0) {
    this.viewManager = new ViewManager();
    this.callbacks = callbacks;
    this.sessionStarted = sessionStarted;
  }

  /**
   * Get view manager instance
   */
  getViewManager(): ViewManager {
    return this.viewManager;
  }

  /**
   * Initialize views
   */
  initialize(): void {
    // Set up view change listener
    this.viewManager.onViewChange((view) => {
      this.callbacks.onViewChanged?.(view);
    });

    // Register editor view
    registerEditorView(this.viewManager.register.bind(this.viewManager), {
      sourceMode: () => this.callbacks.onSourceMode?.() || false,
    });

    // Register disk usage view
    this.setupDiskUsageView();
  }

  /**
   * Switch to a view
   */
  switchTo(view: ViewType): void {
    this.viewManager.switchTo(view);
  }

  /**
   * Get current view
   */
  getCurrent(): ViewType {
    return this.viewManager.getCurrent();
  }

  /**
   * Setup disk usage view registration
   */
  private setupDiskUsageView(): void {
    const editorArea = document.getElementById("editor-area");
    const milkdownEl = document.getElementById("milkdown-editor");
    const sourceEl = document.getElementById("source-editor");

    if (!editorArea || !milkdownEl || !sourceEl) return;

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

  /**
   * Render disk usage view
   */
  private showDiskUsage(): void {
    const provider = getProvider();
    const self = this;

    provider?.getTree().then(async (tree) => {
      if (self.viewManager.getCurrent() !== "disk-usage") return;

      const fileSizes = new Map<string, number>();
      const lastModified = new Map<string, number>();
      const leaves = collectLeaves(tree);

      // Collect file sizes from cache and provider
      for (const leaf of leaves) {
        const existing = cache.getBody(leaf) || cache.getBaseline(leaf);
        if (existing) {
          fileSizes.set(leaf, existing.length);
        } else {
          try {
            const content = await provider?.readFile(leaf);
            if (content && self.viewManager.getCurrent() === "disk-usage") {
              fileSizes.set(leaf, stripFrontmatter(content).body.length);
            }
          } catch (error) {
            console.error(`Failed to read ${leaf}:`, error);
          }
        }

        const st = cache.getServerTime(leaf);
        if (st) lastModified.set(leaf, st);
      }

      const editorArea = document.getElementById("editor-area");
      if (!editorArea || self.viewManager.getCurrent() !== "disk-usage") return;

      // Render disk usage view
      mountDiskUsageView(
        editorArea,
        {
          tree,
          fileSizes,
          lastModified,
          providerName: getProviderDisplayInfo(provider.name).label,
          sessionStarted: self.sessionStarted,
        },
        () => self.viewManager.switchTo("editor")
      );
    });
  }
}
