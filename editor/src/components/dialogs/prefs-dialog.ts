import { html, render } from "lit-html"
import { loadPrefs, savePrefs } from "../../storage"
import type { ImageStorageMode } from "../../storage"

export function applyThemeFromPrefs() {
  const prefs = loadPrefs()
  if (prefs.darkMode) {
    document.documentElement.setAttribute("data-theme", "dark")
  } else {
    document.documentElement.removeAttribute("data-theme")
  }
}

function createOverlay(): HTMLDivElement {
  const existing = document.getElementById("predoc-dialog-overlay")
  if (existing) existing.remove()
  const overlay = document.createElement("div")
  overlay.id = "predoc-dialog-overlay"
  document.body.appendChild(overlay)
  return overlay
}

export interface PrefsDialogActions {
  onStickyToolbarChange: (sticky: boolean) => void
  onImageStorageModeChange?: (mode: ImageStorageMode) => void
}

export function mountPrefsDialog(actions: PrefsDialogActions) {
  const overlay = createOverlay()
  const prefs = loadPrefs()

  const tmpl = html`
    <div class="predoc-prefs-box" @click=${(e: MouseEvent) => e.stopPropagation()}>
      <h3>Preferences</h3>
      <label>
        <input type="checkbox" id="predoc-sticky-checkbox" ?checked=${prefs.stickyToolbar} />
        Pin toolbar to top
      </label>
      <label>
        <input type="checkbox" id="predoc-dark-checkbox" ?checked=${prefs.darkMode} />
        Dark mode
      </label>
      <div class="prefs-section">
        <div class="prefs-section-title">Image storage</div>
        <div class="radio-group">
          <label>
            <input type="radio" name="image-mode" value="file" ?checked=${prefs.imageStorageMode === "file"} />
            Save to <code>image/</code> folder
          </label>
          <label>
            <input type="radio" name="image-mode" value="base64" ?checked=${prefs.imageStorageMode === "base64"} />
            Embed as base64 in document
          </label>
        </div>
      </div>
      <div class="predoc-prefs-actions">
        <button class="predoc-prefs-close">Close</button>
      </div>
    </div>
  `

  render(tmpl, overlay)

  const box = overlay.querySelector(".predoc-prefs-box")!
  const stickyCheckbox = box.querySelector("#predoc-sticky-checkbox") as HTMLInputElement
  const darkCheckbox = box.querySelector("#predoc-dark-checkbox") as HTMLInputElement
  const radioButtons = box.querySelectorAll<HTMLInputElement>('input[name="image-mode"]')

  stickyCheckbox.addEventListener("change", () => {
    prefs.stickyToolbar = stickyCheckbox.checked
    savePrefs(prefs)
    actions.onStickyToolbarChange(stickyCheckbox.checked)
  })

  darkCheckbox.addEventListener("change", () => {
    prefs.darkMode = darkCheckbox.checked
    savePrefs(prefs)
    if (prefs.darkMode) {
      document.documentElement.setAttribute("data-theme", "dark")
    } else {
      document.documentElement.removeAttribute("data-theme")
    }
  })

  radioButtons.forEach((radio) => {
    radio.addEventListener("change", () => {
      if (radio.checked) {
        prefs.imageStorageMode = radio.value as ImageStorageMode
        savePrefs(prefs)
        actions.onImageStorageModeChange?.(prefs.imageStorageMode)
      }
    })
  })

  box.querySelector(".predoc-prefs-close")!.addEventListener("click", () => {
    overlay.remove()
  })

  overlay.addEventListener("click", () => {
    overlay.remove()
  })
}
