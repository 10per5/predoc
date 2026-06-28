interface PendingImage {
  id: string
  file: File
  blobUrl: string
  dir: string
}

interface KnownImage {
  name: string
  url: string
  storageUrl: string
  usedIn: string[]
}

class ImageRegistry {
  private pendingByDir = new Map<string, PendingImage[]>()
  private knownByDir = new Map<string, KnownImage[]>()
  private counter = 0

  addPending(file: File, dir: string): string {
    const id = `pi-${++this.counter}`
    const blobUrl = URL.createObjectURL(file)
    const list = this.pendingByDir.get(dir) || []
    list.push({ id, file, blobUrl, dir })
    this.pendingByDir.set(dir, list)
    return blobUrl
  }

  getPending(dir: string): PendingImage[] {
    return this.pendingByDir.get(dir) || []
  }

  hasPending(dir: string): boolean {
    return (this.pendingByDir.get(dir) || []).length > 0
  }

  getAllPendingDirs(): string[] {
    return Array.from(this.pendingByDir.keys())
  }

  getBlobUrl(id: string): string | undefined {
    for (const list of this.pendingByDir.values()) {
      const found = list.find(p => p.id === id)
      if (found) return found.blobUrl
    }
    return undefined
  }

  async commitPending(dir: string, upload: (file: File, dir: string) => Promise<string>): Promise<Map<string, string>> {
    const list = this.pendingByDir.get(dir) || []
    const urlMap = new Map<string, string>()
    for (const p of list) {
      const url = await upload(p.file, dir)
      urlMap.set(p.blobUrl, url)
      URL.revokeObjectURL(p.blobUrl)
    }
    this.pendingByDir.delete(dir)
    return urlMap
  }

  removePending(id: string): boolean {
    for (const [dir, list] of this.pendingByDir) {
      const idx = list.findIndex(p => p.id === id)
      if (idx !== -1) {
        URL.revokeObjectURL(list[idx].blobUrl)
        list.splice(idx, 1)
        if (list.length === 0) this.pendingByDir.delete(dir)
        return true
      }
    }
    return false
  }

  removeAllForDir(dir: string): void {
    const list = this.pendingByDir.get(dir)
    if (list) {
      list.forEach(p => URL.revokeObjectURL(p.blobUrl))
      this.pendingByDir.delete(dir)
    }
  }

  setKnown(dir: string, entries: KnownImage[]): void {
    this.knownByDir.set(dir, entries)
  }

  getKnown(dir: string): KnownImage[] {
    return this.knownByDir.get(dir) || []
  }

  removeKnown(dir: string, name: string): boolean {
    const list = this.knownByDir.get(dir)
    if (!list) return false
    const idx = list.findIndex(k => k.name === name)
    if (idx === -1) return false
    list.splice(idx, 1)
    return true
  }
}

export const imageRegistry = new ImageRegistry()
