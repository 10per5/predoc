import type { ContentProvider, TreeNode } from "./provider"

const STORAGE_PREFIX = "predoc:"

export class LocalStorageProvider implements ContentProvider {
  readonly name = "localStorage"

  async getTree(): Promise<TreeNode> {
    const result: TreeNode = {}
    const mdKeys = this.getAllMdKeys()
    for (const key of mdKeys) {
      const relPath = key.slice(STORAGE_PREFIX.length)
      const parts = relPath.split("/")
      let current = result
      for (let i = 0; i < parts.length; i++) {
        const isLeaf = i === parts.length - 1
        if (isLeaf) {
          const content = localStorage.getItem(key)
          if (content) {
            const match = content.match(/^---\n([\s\S]*?)\n---/)
            if (match) {
              const weightMatch = match[1].match(/^weight:\s*(\d+)/m)
              if (weightMatch) {
                current[parts[i]] = { weight: parseInt(weightMatch[1], 10) }
                continue
              }
            }
          }
          current[parts[i]] = null
        } else {
          if (!current[parts[i]] || typeof current[parts[i]] !== "object" || current[parts[i]] === null) {
            current[parts[i]] = {}
          }
          current = current[parts[i]] as TreeNode
        }
      }
    }
    return result
  }

  private getAllMdKeys(): string[] {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX) && key.endsWith(".md")) {
        keys.push(key)
      }
    }
    return keys
  }

  async readFile(path: string): Promise<string | null> {
    return localStorage.getItem(STORAGE_PREFIX + path + ".md")
  }

  async writeFile(path: string, content: string): Promise<void> {
    localStorage.setItem(STORAGE_PREFIX + path + ".md", content)
  }

  async deleteFile(path: string): Promise<void> {
    localStorage.removeItem(STORAGE_PREFIX + path + ".md")
  }

  async moveFile(from: string, to: string): Promise<void> {
    const content = await this.readFile(from)
    if (content === null) throw new Error("Source not found")
    await this.writeFile(to, content)
    await this.deleteFile(from)
  }

  async getServerTime(_path: string): Promise<number | null> {
    return null
  }
}
