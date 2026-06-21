export type TreeNode = Record<string, null | { weight: number } | TreeNode>

export interface ContentProvider {
  readonly name: string
  getTree(): Promise<TreeNode>
  readFile(path: string): Promise<string | null>
  writeFile(path: string, content: string): Promise<void>
  deleteFile(path: string): Promise<void>
  moveFile(from: string, to: string): Promise<void>
  getServerTime(path: string): Promise<number | null>
}