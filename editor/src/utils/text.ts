export function normalizeMd(md: string): string {
  return md.replace(/\r\n/g, "\n").replace(/\n+$/, "\n")
}

export function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = "0"
  textarea.style.height = textarea.scrollHeight + "px"
}