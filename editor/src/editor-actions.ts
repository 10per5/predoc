import { confirmDialog, promptDialog } from "./components/dialogs/dialog"
import { serializeFrontmatter } from "./utils/frontmatter"
import type { MetaPanelData } from "./components/panels/meta-panel"
import { cache } from "./cache"
import type { CacheManagementService } from "./services/cache-management-service"

export async function createPage(
  cacheService: CacheManagementService,
  parentPath: string,
  doNavigate: (path: string) => void,
  loadSidebar: () => Promise<void>
): Promise<void> {
  const name = await promptDialog({
    title: "New Page",
    label: "Page name:",
    placeholder: "My New Page",
  })
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
  const content = `---\n${fmStr}\n---\n\n${body}`

  cacheService.queueCreate(fullPath, content)
  cache.setFrontmatter(fullPath, fmData)
  cache.cacheBody(fullPath, body)
  cache.setBaseline(fullPath, body)

  await loadSidebar()
  doNavigate(fullPath)
}

export async function deletePage(
  cacheService: CacheManagementService,
  pagePath: string,
  afterDelete: () => void
): Promise<boolean> {
  const confirmed = await confirmDialog({
    title: "Delete page",
    message: `Are you sure you want to delete "${pagePath}"? This operation must be flushed to take effect.`,
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
  })
  if (!confirmed) return false

  cacheService.queueDelete(pagePath)
  afterDelete()
  return true
}

export async function renamePage(
  cacheService: CacheManagementService,
  pagePath: string,
  afterRename: (newPath: string | null) => void
): Promise<void> {
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

  cacheService.queueRename(pagePath, newPath)
  afterRename(newPath)
}

export async function movePage(
  cacheService: CacheManagementService,
  from: string,
  to: string,
  afterMove: () => void
): Promise<void> {
  if (from === to) return
  cacheService.queueMove(from, to)
  afterMove()
}
