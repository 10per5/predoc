declare var EDITOR_SELF_BASE: string | undefined;
export const editorSelfBase: string =
  typeof EDITOR_SELF_BASE !== "undefined" ? EDITOR_SELF_BASE : "/";
