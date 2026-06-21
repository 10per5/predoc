export type ViewType = "editor" | "disk-usage"

export class ViewManager {
  private current: ViewType = "editor"
  private views = new Map<ViewType, { activate: () => void; deactivate: () => void }>()
  private onChange: ((view: ViewType) => void) | null = null

  register(type: ViewType, handlers: { activate: () => void; deactivate: () => void }) {
    this.views.set(type, handlers)
  }

  onViewChange(cb: (view: ViewType) => void) {
    this.onChange = cb
  }

  switchTo(type: ViewType) {
    if (type === this.current) return
    this.views.get(this.current)?.deactivate()
    this.current = type
    this.views.get(type)?.activate()
    this.onChange?.(type)
  }

  getCurrent(): ViewType {
    return this.current
  }
}
