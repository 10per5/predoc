import { loadPrefs, savePrefs } from "../storage"
import { getProvider } from "../content/provider-registry"

let currentDocDir = ""

export function setCurrentDocDir(dir: string) {
  currentDocDir = dir
}

export function getCurrentDocDir(): string {
  return currentDocDir
}

export function isBase64Mode(): boolean {
  return loadPrefs().imageStorageMode === "base64"
}

export async function uploadImage(file: File): Promise<string> {
  if (isBase64Mode()) {
    return readFileAsBase64(file)
  }
  return uploadToServer(file)
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function uploadToServer(file: File): Promise<string> {
  const provider = getProvider()
  if (provider.name === "remote") {
    const form = new FormData()
    form.append("file", file)
    form.append("dir", currentDocDir)
    const resp = await fetch("/api/upload", { method: "POST", body: form })
    if (!resp.ok) throw new Error(`Upload failed: ${resp.statusText}`)
    const result = await resp.json()
    return result.url
  }

  if (provider.name === "fs") {
    return readFileAsBase64(file)
  }

  return readFileAsBase64(file)
}
