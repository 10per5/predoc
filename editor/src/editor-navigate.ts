import { editorSelfBase } from "./config"
import type { TreeNode } from "./components/panels/sidebar"
import { setPageList, setPageTitles } from "./pages"
import { stripFrontmatter } from "./utils/frontmatter"
import type { MetaPanelData } from "./components/panels/meta-panel"
import { getProvider } from "./controllers/editor_controller"

export async function fetchPageContent(path: string): Promise<{
  content: string
  frontmatter: MetaPanelData | null
}> {
  const provider = getProvider()
  const raw = await provider.readFile(path)
  if (!raw) return { content: "# New Page\n\nStart writing...", frontmatter: null }
  const { frontmatter, body } = stripFrontmatter(raw)
  return { content: body, frontmatter }
}

export async function fetchPageRaw(path: string): Promise<string> {
  const provider = getProvider()
  return await provider.readFile(path) || ""
}

export function collectPageList(tree: TreeNode, prefix = ""): string[] {
  const pages: string[] = []
  for (const [name, val] of Object.entries(tree)) {
    const path = prefix ? `${prefix}/${name}` : name
    const isPage = val === null || (typeof val === "object" && "weight" in val)
    if (isPage) {
      pages.push(path)
    } else {
      pages.push(...collectPageList(val as TreeNode, path))
    }
  }
  return pages
}

export function setupNavListeners() {
  document.querySelectorAll("[data-nav]").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault()
      const link = el.getAttribute("data-nav")!
      window.history.pushState({ path: link }, "", `${editorSelfBase}${link === "_index" ? "" : link}`)
      window.dispatchEvent(new PopStateEvent("popstate", { state: { path: link } }))
    })
  )
}