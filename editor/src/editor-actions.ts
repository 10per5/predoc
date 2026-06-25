import { confirmDialog, promptDialog } from "./components/dialogs/dialog"
import { serializeFrontmatter } from "./utils/frontmatter"
import type { MetaPanelData } from "./components/panels/meta-panel"
import { getProvider } from "./content/provider-registry"
import { cache } from "./cache"

export async function createPage(
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

  const provider = getProvider()
  const fullContent = `---\n${fmStr}\n---\n\n${body}`
  await provider.writeFile(fullPath, fullContent)

  cache.setFrontmatter(fullPath, fmData)
  await loadSidebar()
  doNavigate(fullPath)
}

export async function deletePage(
  pagePath: string,
  afterDelete: () => void
): Promise<boolean> {
  const confirmed = await confirmDialog({
    title: "Delete page",
    message: `Are you sure you want to delete "${pagePath}"? This cannot be undone.`,
    confirmLabel: "Delete",
    cancelLabel: "Cancel",
  })
  if (!confirmed) return false

  const provider = getProvider()
  await provider.deleteFile(pagePath)
  afterDelete()
  return true
}

export async function renamePage(
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

  const provider = getProvider()
  await provider.moveFile(pagePath, newPath)
  afterRename(newPath)
}

export async function movePage(
  from: string,
  to: string,
  afterMove: () => void
): Promise<void> {
  if (from === to) return

  const provider = getProvider()
  await provider.moveFile(from, to)
  afterMove()
}
