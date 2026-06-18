import type { Editor } from "@milkdown/kit/core";
import { editorViewCtx, serializerCtx } from "@milkdown/kit/core";
import { parserCtx } from "@milkdown/core";
import { autoResize } from "./utils/text";

export function setEditorContent(milkdown: Editor, content: string) {
  milkdown.action((ctx) => {
    const parser = ctx.get(parserCtx);
    const view = ctx.get(editorViewCtx);
    const doc = parser(content);
    const tr = view.state.tr.replaceWith(
      0,
      view.state.doc.content.size,
      doc.content,
    );
    view.dispatch(tr);
  });
}

export function getEditorMarkdown(milkdown: Editor): string {
  return milkdown.action((ctx) => {
    const serializer = ctx.get(serializerCtx);
    return serializer(ctx.get(editorViewCtx).state.doc);
  });
}

export function toggleSourceMode(
  milkdown: Editor,
  sourceEl: HTMLElement,
  wysiwygEl: HTMLElement,
  sourceMode: boolean,
): boolean {
  const newMode = !sourceMode;
  if (newMode) {
    milkdown.action((ctx) => {
      const md = getEditorMarkdown(milkdown);
      sourceEl.style.display = "flex";
      wysiwygEl.style.display = "none";
      const ta = sourceEl.querySelector("textarea") as HTMLTextAreaElement;
      ta.value = md;
      ta.oninput = () => autoResize(ta);
      autoResize(ta);
    });
  } else {
    sourceEl.style.display = "none";
    wysiwygEl.style.display = "block";
  }
  return newMode;
}

export function applySourceContent(
  milkdown: Editor,
  textarea: HTMLTextAreaElement,
): boolean {
  if (!milkdown) return false;
  setEditorContent(milkdown, textarea.value);
  return true;
}
