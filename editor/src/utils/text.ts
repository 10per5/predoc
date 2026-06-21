export function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = "0"
  textarea.style.height = textarea.scrollHeight + "px"
}