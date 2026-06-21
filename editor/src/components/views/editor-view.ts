import type { ViewManager, ViewType } from "./view"

export interface EditorViewOptions {
  sourceMode: () => boolean
}

export function registerEditorView(
  registerFn: ViewManager["register"],
  opts: EditorViewOptions,
) {
  const milkdownEl = document.getElementById("milkdown-editor")!
  const sourceEl = document.getElementById("source-editor")!
  const editorArea = document.getElementById("editor-area")!

  registerFn("editor", {
    activate: () => {
      milkdownEl.style.display = ""
      sourceEl.style.display = opts.sourceMode() ? "" : "none"
      const du = editorArea.querySelector(".disk-usage-wrapper")
      if (du) du.remove()
    },
    deactivate: () => {
      milkdownEl.style.display = "none"
      sourceEl.style.display = "none"
    },
  })
}
