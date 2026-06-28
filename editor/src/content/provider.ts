export type TreeNode = Record<string, null | { weight: number } | TreeNode>

export interface ImageEntry {
  name: string
  url: string
  storageUrl: string
  usedIn: string[]
}

export interface ContentProvider {
  readonly name: string
  getTree(): Promise<TreeNode>
  readFile(path: string): Promise<string | null>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  moveFile(from: string, to: string): Promise<void>
  getServerTime(path: string): Promise<number | null>
  uploadImage?(file: File, dir: string): Promise<string>
  listImages?(dir: string, refs?: boolean): Promise<ImageEntry[]>
  deleteImage?(name: string, dir: string): Promise<void>
  resolveImageUrl?(url: string): string | undefined
}