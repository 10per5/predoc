import "@milkdown/theme-nord/style.css"
import "./styles/global.css"
import "./styles/milkdown.css"

import { Application } from "@hotwired/stimulus"
import EditorController, { setProvider, setSessionStarted } from "./controllers/editor_controller"
import { initToast } from "./components/toast/toast"
import { createProvider } from "./content"

async function init() {
  setSessionStarted(Date.now())

  const provider = await createProvider()
  setProvider(provider)

  const app = Application.start()
  app.register("editor", EditorController)

  document.addEventListener("turbo:load", () => {
    app.load()
    initToast()
  })
  initToast()
}

init()
