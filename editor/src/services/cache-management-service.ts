/**
 * CacheManagementService
 * 
 * Manages file caching, dirty tracking, and file synchronization
 * Handles flushing changes and discarding edits
 */

import { stripFrontmatter, serializeFrontmatter } from "../utils/frontmatter";
import { mountChangesDialog, type ChangesDialogData } from "../components/dialogs/changes-dialog";
import { confirmDialog } from "../components/dialogs/dialog";
import { cache } from "../cache";
import { getProvider } from "../content/provider-registry";

export interface CacheCallbacks {
  getCurrentContent?: () => string;
  onFlushComplete?: () => void;
  onDiscardComplete?: () => void;
  onDirtyCountChanged?: (count: number, bytes: number) => void;
  onNavigate?: (path: string) => void;
  onContentReload?: (path: string, content: string) => Promise<void>;
}

export class CacheManagementService {
  private callbacks: CacheCallbacks;
  private currentPath: string = "";

  constructor(callbacks: CacheCallbacks = {}) {
    this.callbacks = callbacks;
  }

  /**
   * Set current path context
   */
  setCurrentPath(path: string): void {
    this.currentPath = path;
  }

  /**
   * Update dirty counter UI
   */
  updateDirtyCounter(): void {
    let totalBytes = 0;
    for (const path of cache.getDirtyPaths()) {
      totalBytes += cache.getBodyDelta(path);
    }
    const count = cache.getDirtyCount();
    this.callbacks.onDirtyCountChanged?.(count, totalBytes);
  }

  /**
   * Get current dirty state
   */
  getDirtyState(): { count: number; bytes: number } {
    let totalBytes = 0;
    for (const path of cache.getDirtyPaths()) {
      totalBytes += cache.getBodyDelta(path);
    }
    return {
      count: cache.getDirtyCount(),
      bytes: totalBytes,
    };
  }

  /**
   * Flush all dirty files to provider
   */
  async flushDirtyFiles(): Promise<void> {
    const dirtyPaths = cache.getDirtyPaths();
    if (dirtyPaths.length === 0) return;

    const currentMd = this.callbacks.getCurrentContent?.() || "";
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

      // Check for server-side modifications
      if (path === this.currentPath) {
        const serverTime = cache.getServerTime(path);
        if (serverTime) {
          const fileTime = await provider?.getServerTime(path);
          if (fileTime && fileTime > serverTime) {
            if (!confirm(`"${path}" was modified on disk. Overwrite?`)) continue;
          }
        }
      }

      try {
        await provider?.writeFile(path, fullContent);
        cache.deletePatch(path);
        cache.setBaseline(path, body);
        cache.cacheBody(path, body);
        const fileTime = await provider?.getServerTime(path);
        if (fileTime) cache.setServerTime(path, fileTime);
      } catch (error) {
        console.error(`Failed to flush ${path}:`, error);
      }
    }

    cache.sync();
    this.updateDirtyCounter();
    this.callbacks.onFlushComplete?.();
  }

  /**
   * Discard changes for a file
   */
  async discardFileChanges(pagePath: string): Promise<void> {
    const confirmed = await confirmDialog({
      title: "Discard changes",
      message: `Discard unsaved changes to "${pagePath}"? This cannot be undone.`,
      confirmLabel: "Discard",
      confirmClass: "predoc-dialog-confirm",
    });

    if (!confirmed) return;

    cache.clearPath(pagePath);
    cache.sync();
    this.updateDirtyCounter();

    if (pagePath === this.currentPath) {
      const provider = getProvider();
      const raw = (await provider?.readFile(pagePath)) || "";
      const { frontmatter, body } = stripFrontmatter(raw);
      if (frontmatter) cache.setFrontmatter(pagePath, frontmatter);
      cache.setBaseline(pagePath, body);

      await this.callbacks.onContentReload?.(pagePath, body);
    }

    this.callbacks.onDiscardComplete?.();
  }

  /**
   * Handle dirty click - show changes dialog
   */
  async handleDirtyClick(): Promise<void> {
    const dirtyPaths = cache.getDirtyPaths();
    if (dirtyPaths.length === 0) return;

    const provider = getProvider();
    const changes: ChangesDialogData[] = [];

    for (const path of dirtyPaths) {
      let md = cache.reconstructContent(path);

      if (!md && path === this.currentPath) {
        md = this.callbacks.getCurrentContent?.();
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

    await mountChangesDialog(
      changes,
      this.currentPath,
      {
        onDiscard: (path) => {
          cache.clearPath(path);
          cache.sync();
          this.updateDirtyCounter();

          if (path === this.currentPath) {
            provider?.readFile(path).then((raw) => {
              const { frontmatter, body } = stripFrontmatter(raw || "");
              if (frontmatter) cache.setFrontmatter(path, frontmatter);
              cache.setBaseline(path, body);
              this.callbacks.onContentReload?.(path, body);
            });
          }
        },
        onNavigate: (path) => this.callbacks.onNavigate?.(path),
        onReload: async (path) => (await provider?.readFile(path)) || "",
        onFlushAll: () => this.flushDirtyFiles(),
        onDiscardAll: async () => {
          const paths = cache.getDirtyPaths();
          for (const p of paths) {
            cache.clearPath(p);
          }
          cache.sync();
          this.updateDirtyCounter();

          if (paths.includes(this.currentPath)) {
            const raw = (await provider?.readFile(this.currentPath)) || "";
            const { frontmatter, body } = stripFrontmatter(raw);
            if (frontmatter) cache.setFrontmatter(this.currentPath, frontmatter);
            cache.setBaseline(this.currentPath, body);
            await this.callbacks.onContentReload?.(this.currentPath, body);
          }
        },
      },
      () => {}
    );
  }
}
