import { Controller } from "@hotwired/stimulus"
import { AppOrchestrator } from "../orchestrator"
import { getCurrentPath } from "../utils/url"

export default class extends Controller {
  private orchestrator!: AppOrchestrator

  async connect() {
    const initialPath = this.data.get("path") || getCurrentPath()
    this.orchestrator = new AppOrchestrator({ initialPath })
    await this.orchestrator.initialize()
  }

  disconnect() {
    this.orchestrator?.destroy()
  }

  toggleSource = () => this.orchestrator.editor.toggleSourceMode()
  applySource  = () => this.orchestrator.editor.applySourceContent()
  flush        = () => this.orchestrator.cache.flushDirtyFiles()
}
