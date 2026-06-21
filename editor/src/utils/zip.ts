import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate"
import { showToast } from "../components/toast/toast"

const STORAGE_PREFIX = "predoc:"

export async function exportToZip(): Promise<void> {
  const files: Record<string, Uint8Array> = {}
  let count = 0

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(STORAGE_PREFIX)) {
      const relPath = key.slice(STORAGE_PREFIX.length)
      const content = localStorage.getItem(key)
      if (content) {
        files[relPath] = strToU8(content)
        count++
      }
    }
  }

  if (count === 0) {
    showToast("No files to export")
    return
  }

  const zipped = zipSync(files, { level: 0 })
  const blob = new Blob([zipped], { type: "application/zip" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `predoc-backup-${new Date().toISOString().slice(0, 10)}.zip`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  showToast(`Exported ${count} file${count > 1 ? "s" : ""}`)
}

export async function importFromZip(): Promise<number> {
  const input = document.createElement("input")
  input.type = "file"
  input.accept = ".zip"

  const file = await new Promise<File | null>((resolve) => {
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null))
    input.click()
  })

  if (!file) return 0

  const buffer = await file.arrayBuffer()
  const data = new Uint8Array(buffer)

  let extracted: Record<string, Uint8Array>
  try {
    extracted = unzipSync(data)
  } catch {
    showToast("Failed to read zip file")
    return 0
  }

  let count = 0
  for (const [relPath, content] of Object.entries(extracted)) {
    if (!relPath.endsWith(".md")) continue
    localStorage.setItem(STORAGE_PREFIX + relPath, strFromU8(content))
    count++
  }

  if (count === 0) {
    showToast("No markdown files found in archive")
    return 0
  }

  showToast(`Imported ${count} file${count > 1 ? "s" : ""}`)
  return count
}
