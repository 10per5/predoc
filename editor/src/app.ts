import "@milkdown/theme-nord/style.css"

/* KaTeX math inline style */
import "./styles/math.css"

/* Base styles and CSS variables */
import "./styles/base.css"

/* Layout structure */
import "./styles/layout.css"

/* Component styles */
import "./styles/toolbar.css"
import "./styles/editor.css"
import "./styles/panels.css"
import "./styles/search.css"
import "./styles/milkdown.css"
import "./styles/dialogs.css"

/* Responsive adjustments (applied last for higher specificity) */
import "./styles/responsive.css"

import { Application } from "@hotwired/stimulus"
import ShellController from "./controllers/shell_controller"
import { setSessionStarted } from "./orchestrator"
import { setProvider } from "./providers/provider-registry"
import { initToast } from "./components/notification/toast"
import { initNotifications } from "./components/notification/notification"
import { createProvider } from "./providers"

async function init() {
  setSessionStarted(Date.now())

  const provider = await createProvider()
  setProvider(provider)

  const app = Application.start()
  app.register("editor", ShellController)

  document.addEventListener("turbo:load", () => {
    app.load()
    initToast()
    initNotifications()
  })
  initToast()
  initNotifications()
}

init()
