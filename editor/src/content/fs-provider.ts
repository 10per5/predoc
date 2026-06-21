import type { ContentProvider, TreeNode } from "./provider"
import { stripFrontmatter } from "../utils/frontmatter"

export class FileSystemProvider implements ContentProvider {
  readonly name = "fs"
  private dirHandle: FileSystemDirectoryHandle | null = null

  async init(): Promise<void> {
    if (this.dirHandle) return
    this.dirHandle = await (window as any).showDirectoryPicker()
  }

  async getTree(): Promise<TreeNode> {
    if (!this.dirHandle) await this.init()
    const result: TreeNode = {}
    await this.buildTree(this.dirHandle!, result)
    return result
  }

  private async buildTree(dir: FileSystemDirectoryHandle, out: TreeNode): Promise<void> {
    for await (const entry of dir.values()) {
      if (entry.name.startsWith(".")) continue
      if (entry.kind === "directory") {
        const children: TreeNode = {}
        await this.buildTree(entry as FileSystemDirectoryHandle, children)
        if (Object.keys(children).length > 0) {
          out[entry.name] = children
        }
      } else if (entry.name.endsWith(".md")) {
        const file = await entry.getFile()
        const text = await file.text()
        const match = text.match(/^---\n([\s\S]*?)\n---/)
        if (match) {
          const weightMatch = match[1].match(/^weight:\s*(\d+)/m)
          if (weightMatch) {
            out[entry.name] = { weight: parseInt(weightMatch[1], 10) }
            continue
          }
        }
        out[entry.name] = null
      }
    }
  }

  async readFile(path: string): Promise<string | null> {
    if (!this.dirHandle) await this.init()
    const parts = path.split("/").filter(Boolean)
    let current: FileSystemDirectoryHandle = this.dirHandle!
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i])
    }
    const fileName = parts[parts.length - 1] + ".md"
    try {
      const fileHandle = await current.getFileHandle(fileName)
      const file = await fileHandle.getFile()
      return await file.text()
    } catch {
      return null
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.dirHandle) await this.init()
    const parts = path.split("/").filter(Boolean)
    let current: FileSystemDirectoryHandle = this.dirHandle!
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i], { create: true })
    }
    const fileName = parts[parts.length - 1] + ".md"
    const fileHandle = await current.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
  }

  async deleteFile(path: string): Promise<void> {
    if (!this.dirHandle) await this.init()
    const parts = path.split("/").filter(Boolean)
    let current: FileSystemDirectoryHandle = this.dirHandle!
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i])
    }
    const fileName = parts[parts.length - 1] + ".md"
    await current.removeEntry(fileName)
    await this.cleanupEmptyParents(current, parts.slice(0, -1))
  }

  private async cleanupEmptyParents(dir: FileSystemDirectoryHandle, parts: string[]): Promise<void> {
    if (parts.length === 0) return
    for await (const _ of dir.values()) {
      return
    }
    const parentName = parts.pop()
    if (!parentName) return
    const parent = await this.getParentDir(parts)
    if (parent) {
      try {
        await parent.removeEntry(parentName)
        await this.cleanupEmptyParents(parent, parts)
      } catch {}
    }
  }

  private async getParentDir(parts: string[]): Promise<FileSystemDirectoryHandle | null> {
    if (!this.dirHandle) return null
    if (parts.length === 0) return this.dirHandle
    let current: FileSystemDirectoryHandle = this.dirHandle
    for (const part of parts) {
      try {
        current = await current.getDirectoryHandle(part)
      } catch {
        return null
      }
    }
    return current
  }

  async moveFile(from: string, to: string): Promise<void> {
    const content = await this.readFile(from)
    if (content === null) throw new Error("Source not found")
    await this.writeFile(to, content)
    await this.deleteFile(from)
  }

  async getServerTime(path: string): Promise<number | null> {
    if (!this.dirHandle) await this.init()
    const parts = path.split("/").filter(Boolean)
    let current: FileSystemDirectoryHandle = this.dirHandle!
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i])
    }
    const fileName = parts[parts.length - 1] + ".md"
    try {
      const fileHandle = await current.getFileHandle(fileName)
      const file = await fileHandle.getFile()
      return file.lastModified
    } catch {
      return null
    }
  }
}