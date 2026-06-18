import { html, render } from "lit-html"
import { loadPrefs, savePrefs, type WikiPrefs } from "../../storage"

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
}

export function mountPrefsDialog(actions: PrefsDialogActions) {
  const overlay = createOverlay()
  const prefs = loadPrefs()

  const dialogStyles = `
    #predoc-dialog-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.4);
      z-index: 1000; display: flex; align-items: center; justify-content: center;
    }
    .predoc-prefs-box {
      background: #fff; border-radius: 8px; padding: 1.5rem;
      min-width: 360px; max-width: 480px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    }
    .predoc-prefs-box h3 { margin: 0 0 1rem; font-size: 1.1rem; }
    .predoc-prefs-box label {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.9rem; cursor: pointer;
    }
    .predoc-prefs-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem; }
    .predoc-prefs-actions button {
      padding: 0.4rem 1.2rem; border: 1px solid #d8dee9; border-radius: 4px;
      background: #fff; cursor: pointer; font-size: 0.9rem;
    }
    .predoc-prefs-actions button:hover { background: #e5e9f0; }
  `

  const tmpl = html`
    <style>${dialogStyles}</style>
    <div class="predoc-prefs-box" @click=${(e: MouseEvent) => e.stopPropagation()}>
      <h3>Preferences</h3>
      <label>
        <input type="checkbox" id="predoc-sticky-checkbox" ?checked=${prefs.stickyToolbar} />
        Sticky toolbar (follows on scroll)
      </label>
      <div class="predoc-prefs-actions">
        <button class="predoc-prefs-close">Close</button>
      </div>
    </div>
  `

  render(tmpl, overlay)

  const box = overlay.querySelector(".predoc-prefs-box")!
  const checkbox = box.querySelector("#predoc-sticky-checkbox") as HTMLInputElement

  checkbox.addEventListener("change", () => {
    prefs.stickyToolbar = checkbox.checked
    savePrefs(prefs)
    actions.onStickyToolbarChange(checkbox.checked)
  })

  box.querySelector(".predoc-prefs-close")!.addEventListener("click", () => {
    overlay.remove()
  })

  overlay.addEventListener("click", () => {
    overlay.remove()
  })
}