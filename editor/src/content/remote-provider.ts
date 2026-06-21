import type { ContentProvider, TreeNode } from "./provider"

export class RemoteProvider implements ContentProvider {
  readonly name = "remote"

  async getTree(): Promise<TreeNode> {
    const res = await fetch("/api/tree")
    if (!res.ok) return {}
    return res.json()
  }

  async readFile(path: string): Promise<string | null> {
    const res = await fetch(`/content/${path}.md`)
    if (!res.ok) return null
    return res.text()
  }

  async writeFile(path: string, content: string): Promise<void> {
    await fetch(`/content/${path}.md`, {
      method: "PUT",
      headers: { "Content-Type": "text/markdown" },
      body: content,
    })
  }

  async deleteFile(path: string): Promise<void> {
    await fetch(`/content/${path}.md`, { method: "DELETE" })
  }

  async moveFile(from: string, to: string): Promise<void> {
    const res = await fetch("/api/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: `${from}.md`, to: `${to}.md` }),
    })
    if (!res.ok) throw new Error(`Move failed: ${res.status}`)
  }

  async getServerTime(path: string): Promise<number | null> {
    const res = await fetch(`/content/${path}.md`, { method: "HEAD" })
    if (!res.ok) return null
    const lastModified = res.headers.get("Last-Modified")
    if (!lastModified) return null
    return new Date(lastModified).getTime()
  }
}