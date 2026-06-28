import { Controller } from "@hotwired/stimulus";
import { mountPrefsDialog } from "../components/dialogs/prefs-dialog";
import type { TopbarAPI } from "../components/toolbar/topbar";
import type { MetaPanelAPI } from "../components/panels/meta-panel";
import { ToolbarService } from "../services/toolbar-service";
import { UIInitializerService } from "../services/ui-initializer-service";
import { UIService } from "../services/ui-service";
import { EditorService } from "../services/editor-service";
import { CacheManagementService } from "../services/cache-management-service";
import { ViewManagementService } from "../services/view-management-service";
import { NavigationService } from "../services/navigation-service";
import { getProvider, getProviderDisplayInfo } from "../content/provider-registry";
import { cache } from "../cache";
import { exportToZip, importFromZip } from "../utils/zip";
import { loadPrefs } from "../storage";
import { PathService } from "../services/path-service";

let sessionStarted = 0;

export function setSessionStarted(time: number) {
  sessionStarted = time;
}

export default class extends Controller {
  private toolbarService!: ToolbarService;
  private uiInitializer!: UIInitializerService;
  private uiService!: UIService;
  private editorService!: EditorService;
  private cacheService!: CacheManagementService;
  private viewService!: ViewManagementService;
  private navService!: NavigationService;
  private topbar!: TopbarAPI;
  private metaPanel!: MetaPanelAPI;

  async connect() {
    const initialPath = this.data.get("path")
      || new PathService().getInitialPath();

    this.uiService = UIService.getInstance();
    this.uiInitializer = new UIInitializerService();

    this.editorService = new EditorService({
      onContentChange: (content) => {
        cache.setBody(this.navService.getCurrentPath(), content);
        this.cacheService?.updateDirtyCounter();
      },
      onDirtyChange: () => this.cacheService?.updateDirtyCounter(),
    });
    this.editorService.setCurrentPath(initialPath);

    this.cacheService = new CacheManagementService({
      getCurrentContent: () => this.editorService.getCurrentContent(),
      onDirtyCountChanged: (count, bytes) => {
        this.topbar?.updateCounter(count, bytes);
        this.topbar?.setDirtyState(count > 0);
      },
      onNavigate: (path) => this.navService?.navigate(path),
      onContentReload: (path, body) => this.editorService.ensureEditor(body),
    });
    this.cacheService.setCurrentPath(initialPath);

    this.toolbarService = new ToolbarService({ stickyToolbar: loadPrefs().stickyToolbar });
    this.toolbarService.initialize();

    this.viewService = new ViewManagementService(
      {
        onSourceMode: () => this.editorService.isSourceMode(),
        onViewChanged: (view) => this.topbar?.setView(view),
      },
      sessionStarted
    );

    this.navService = new NavigationService({
      onBeforeNavigate: (path) => {
        this.viewService?.getViewManager().switchTo("editor");
        this.editorService.setCurrentPath(path);
        this.cacheService.setCurrentPath(path);
      },
      onContentNeeded: (path) => this.editorService.fetchContent(path, (data) => this.metaPanel?.update(data)),
      onContentReady: (path, content) => this.editorService.ensureEditor(content),
      onNavigate: () => {},
      onSidebarReload: async () => {
        await this.loadSidebar();
      },
      onProviderChanged: (type) => {
        const pdi = getProviderDisplayInfo(type);
        this.topbar?.setProviderBadge(pdi.icon, pdi.label);
        this.topbar?.setProviderType(type);
      },
      onUpdateUI: () => this.cacheService?.updateDirtyCounter(),
    });
    this.navService.setCurrentPath(initialPath);

    this.viewService.initialize();

    this.topbar = this.uiInitializer.initializeTopbar(
      () => this.editorService.getEditor(),
      {
        onPrefs: () => {
          mountPrefsDialog({
            onStickyToolbarChange: (sticky) => {
              this.toolbarService.setStickyPreference(sticky);
            },
          });
        },
        onDirtyClick: () => this.cacheService.handleDirtyClick(),
        onChangeProvider: () => this.navService.changeProvider(),
        onViewChange: (view) => this.viewService.getViewManager().switchTo(view),
        onSave: () => exportToZip().then(() => this.loadSidebar()),
        onLoad: async () => {
          const count = await importFromZip();
          if (count === 0) return;
          cache.clearAll();
          cache.sync();
          await this.loadSidebar();
          await this.editorService.loadContent(initialPath, (data) => this.metaPanel?.update(data));
        },
        onToggleSidebar: () => this.uiService.toggleSidebar(),
        onToggleMetaPanel: () => this.uiService.toggleMetaPanel(),
      }
    )!;

    const providerInfo = getProviderDisplayInfo(getProvider().name);
    this.topbar?.setProviderBadge(providerInfo.icon, providerInfo.label);
    this.topbar?.setProviderType(getProvider().name);

    this.metaPanel = this.uiInitializer.initializeMetaPanel((data) => {
      const path = this.navService.getCurrentPath();
      cache.setFrontmatter(path, data);
      cache.addDirty(path);
      cache.sync();
      this.cacheService?.updateDirtyCounter();
    })!;

    await this.editorService.loadContent(initialPath, (data) => this.metaPanel?.update(data));
    await this.loadSidebar();
    this.cacheService.updateDirtyCounter();
  }

  disconnect() {
    this.toolbarService?.destroy();
    this.uiService?.destroy();
    this.editorService?.destroy();
  }

  private loadSidebar(): Promise<void> {
    return this.navService.loadSidebar(
      (p) => this.navService.navigate(p),
      (pages, meta) => this.editorService.getMentionView()?.setPages(pages, meta),
    );
  }

  toggleSource = () => this.editorService.toggleSourceMode();
  applySource = () => this.editorService.applySourceContent();
  flush = () => this.cacheService.flushDirtyFiles();
}
