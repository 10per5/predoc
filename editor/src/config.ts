export const editorSelfBase: string =
  (document.querySelector('meta[name="editor-self-base"]')?.getAttribute("content") ?? "/").replace(/\/?$/, "/");

export const liveUrlBase: string =
  document.querySelector('meta[name="live-url-base"]')?.getAttribute("content") ?? "";

export const isDev: boolean =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const ssgMode: boolean =
  document.querySelector('meta[name="ssg-mode"]')?.getAttribute("content") === "true";

export const appVersion: string =
  document.querySelector('meta[name="app-version"]')?.getAttribute("content") ?? "";
