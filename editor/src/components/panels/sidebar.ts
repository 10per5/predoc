import { html, render } from "lit-html";
import { editorSelfBase, liveUrlBase, isDev } from "../../config";
import { liveIcon } from "../icons";
import { buildEditorUrl } from "../../../lib/url";

export interface PageNode {
  weight?: number;
}

export interface TreeNode {
  [key: string]: TreeNode | PageNode | null;
}

export interface SidebarActions {
  onNavigate: (path: string) => void;
  onNewPage: (parentPath: string) => void;
  onDelete: (path: string) => void;
  onRename: (path: string) => void;
  onMove: (from: string, to: string) => void;
  onChangeProvider: () => void;
}

const LINE_COLORS = [
  "#88c0d0",
  "#b48ead",
  "#a3be8c",
  "#ebcb8b",
  "#d08770",
  "#5e81ac",
  "#8fbcbb",
];

let menuTarget = "";
let menuTimer: ReturnType<typeof setTimeout> | null = null;

function closeMenu() {
  document.querySelectorAll(".ctx-menu").forEach((el) => el.remove());
  document.querySelectorAll(".ctx-backdrop").forEach((el) => el.remove());
  menuTarget = "";
}

export function mountSidebar(
  container: HTMLElement,
  tree: TreeNode,
  current: string,
  actions: SidebarActions,
  providerIcon?: string,
  providerLabel?: string,
  providerType?: string,
) {
  const basePath = editorSelfBase;
  const page = current === "_index" ? "" : `/${current}`;
  const baseUrl = liveUrlBase || (isDev ? 'http://localhost:5000' : '');
  const liveUrl = baseUrl ? `${baseUrl}${providerType === "localStorage" ? "" : page}` : "";

  function renderItems(items: TreeNode, prefix = "", depth = 0): unknown {
    const entries = Object.entries(items).sort(
      ([nameA, valA], [nameB, valB]) => {
        if (nameA === "_index.md") return -1;
        if (nameB === "_index.md") return 1;

        const weightA =
          valA != null && typeof valA === "object" && "weight" in valA
            ? ((valA as PageNode).weight ?? Infinity)
            : Infinity;
        const weightB =
          valB != null && typeof valB === "object" && "weight" in valB
            ? ((valB as PageNode).weight ?? Infinity)
            : Infinity;

        if (weightA !== weightB) return weightA - weightB;
        return nameA.localeCompare(nameB);
      },
    );

    const lineColor = LINE_COLORS[depth % LINE_COLORS.length];

    return entries.map(([name, val]) => {
      const path = prefix ? `${prefix}/${name}` : name;
      const isPage =
        val === null || (typeof val === "object" && "weight" in val);

      if (isPage) {
        const pagePath = path.replace(/\.md$/, "");
        const active = pagePath === current;
        let label: string;
        if (name === "_index.md") {
          label = !prefix
            ? "Home"
            : prefix
                .split("/")
                .pop()!
                .replace(/-/g, " ")
                .replace(/^\w/, (c) => c.toUpperCase());
        } else {
          label = name
            .replace(/\.md$/, "")
            .replace(/-/g, " ")
            .replace(/^\w/, (c) => c.toUpperCase());
        }
        return html` <div
          class="nav-item"
          draggable="true"
          data-nav-path="${pagePath}"
          @dragstart=${(e: DragEvent) => {
            e.dataTransfer?.setData("text/plain", pagePath);
          }}
          @dragover=${(e: DragEvent) => e.preventDefault()}
          @drop=${(e: DragEvent) => {
            e.preventDefault();
            const from = e.dataTransfer?.getData("text/plain");
            if (from) actions.onMove(from, pagePath);
          }}
        >
          <a
            href="${buildEditorUrl(basePath, pagePath)}"
            class="nav-link ${active ? "active" : ""}${name === "_index.md" &&
            !prefix
              ? " nav-link-home"
              : ""}"
            @click=${(e: Event) => {
              e.preventDefault();
              actions.onNavigate(pagePath);
            }}
          >
            ${label}
          </a>
          <button
            class="nav-more"
            @click=${(e: Event) => {
              e.stopPropagation();
              showMenu(e.target as HTMLElement, pagePath, actions);
            }}
          >
            ⋮
          </button>
        </div>`;
      }
      const childrenDepth = depth + 1;
      const children = renderItems(val as TreeNode, path, childrenDepth);
      const label = name
        .replace(/-/g, " ")
        .replace(/^\w/, (c) => c.toUpperCase());
      return html` <div
        class="nav-section"
        @dragover=${(e: DragEvent) => e.preventDefault()}
        @drop=${(e: DragEvent) => {
          e.preventDefault();
          const from = e.dataTransfer?.getData("text/plain");
          if (from) {
            const to = path + "/" + from.split("/").pop();
            actions.onMove(from, to);
          }
        }}
      >
        <span class="nav-section-title depth-${depth}">${label}</span>
        <div class="nav-section-children" style="--line-color: ${lineColor}">
          ${children}
        </div>
      </div>`;
    });
  }

  const treeEmpty = Object.keys(tree).length === 0;

  render(
    html`
      <div class="sidebar-wrapper">
        ${treeEmpty
          ? html`
              <div class="sidebar-provider-bar">
                <span class="provider-label"
                  >${providerIcon ?? ""} ${providerLabel ?? "No provider"}</span
                >
                <button
                  class="provider-change-btn"
                  @click=${() => actions.onChangeProvider()}
                >
                  Change
                </button>
              </div>
            `
          : html``}
        <div class="sidebar-inner">
          ${treeEmpty ? html`<div class="sidebar-empty">No files</div>` : renderItems(tree)}
          <button
            class="nav-new-page"
            @click=${() => actions.onNewPage("docs")}
          >
            + New Page
          </button>
        </div>
        <div class="sidebar-footer">
          ${liveUrl
            ? html`
                <a
                  href="${liveUrl}"
                  rel="noopener noreferrer"
                  class="nav-live-link"
                >
                  ${liveIcon}
                  <span>View live version</span>
                </a>
              `
            : html``}
        </div>
      </div>
    `,
    container,
  );
}

function showMenu(
  anchor: HTMLElement,
  pagePath: string,
  actions: SidebarActions,
) {
  closeMenu();

  const rect = anchor.getBoundingClientRect();
  const backdrop = document.createElement("div");
  backdrop.className = "ctx-backdrop";
  backdrop.addEventListener("click", closeMenu);
  document.body.appendChild(backdrop);

  const menu = document.createElement("div");
  menu.className = "ctx-menu";
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
  menu.innerHTML = `
    <div data-action="new">New Page</div>
    <div data-action="rename">Rename</div>
    <div data-action="delete">Delete</div>
  `;
  menu.addEventListener("click", (e) => {
    const item = (e.target as HTMLElement).closest(
      "[data-action]",
    ) as HTMLElement;
    if (!item) return;
    closeMenu();
    switch (item.dataset.action) {
      case "new":
        actions.onNewPage(pagePath);
        break;
      case "rename":
        actions.onRename(pagePath);
        break;
      case "delete":
        actions.onDelete(pagePath);
        break;
    }
  });
  document.body.appendChild(menu);
}
