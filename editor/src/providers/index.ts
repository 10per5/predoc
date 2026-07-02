import type { ContentProvider } from "@/providers/provider"
import { RemoteProvider } from "@/providers/remote-provider"
import { FileSystemProvider } from "@/providers/fs-provider"
import { LocalStorageProvider } from "@/providers/local-storage-provider"

export type ProviderType = "remote" | "filesystem" | "localStorage"

export interface ProviderInfo {
  type: ProviderType
  description: string
  available: boolean
  reason?: string
}

export async function createProvider(): Promise<ContentProvider> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 500)
  try {
    const res = await fetch("/api/tree", { method: "HEAD", signal: controller.signal })
    clearTimeout(id)
    console.log("[content] probe /api/tree ->", res.status)
    if (res.ok || res.status === 200) {
      console.log("[content] using RemoteProvider")
      return new RemoteProvider()
    }
  } catch (e) {
    clearTimeout(id)
    console.log("[content] probe failed:", e)
  }

  const fsAPI = (window as any).showDirectoryPicker
  console.log("[content] showDirectoryPicker:", typeof fsAPI)

  if (fsAPI) {
    console.log("[content] using FileSystemProvider")
    return new FileSystemProvider()
  }

  console.log("[content] using LocalStorageProvider (Firefox fallback)")
  return new LocalStorageProvider()
}

export function getProviderTypeName(type: ProviderType): string {
  switch (type) {
    case "remote": return "remote"
    case "filesystem": return "fs"
    case "localStorage": return "localStorage"
  }
}

export async function getAvailableProviders(): Promise<ProviderInfo[]> {
  const providers: ProviderInfo[] = []

  let remoteAvailable = false
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 500)
    const res = await fetch("/api/tree", { method: "HEAD", signal: controller.signal })
    clearTimeout(id)
    remoteAvailable = res.ok || res.status === 200
  } catch {
    // not available
  }

  providers.push({
    type: "remote",
    description: "Files served from a backend server via HTTP API",
    available: remoteAvailable,
    reason: remoteAvailable ? undefined : "No content server detected",
  })

  const hasFs = typeof (window as any).showDirectoryPicker === "function"
  providers.push({
    type: "filesystem",
    description: "Access local markdown files via the File System Access API (Chrome/Edge)",
    available: hasFs,
    reason: hasFs ? undefined : "Not supported in this browser (use Chrome or Edge)",
  })

  providers.push({
    type: "localStorage",
    description: "Store files in browser local storage — persists across sessions",
    available: true,
  })

  return providers
}

export function createProviderByType(type: ProviderType): ContentProvider {
  switch (type) {
    case "remote":
      return new RemoteProvider()
    case "filesystem":
      return new FileSystemProvider()
    case "localStorage":
      return new LocalStorageProvider()
  }
}
