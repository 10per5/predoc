import { SlashProvider } from "@milkdown/kit/plugin/slash"
import type { EditorView } from "@milkdown/kit/prose/view"
import type { EditorState } from "@milkdown/kit/prose/state"
import { commandsCtx, editorViewCtx } from "@milkdown/kit/core"
import type { Ctx } from "@milkdown/kit/ctx"
import {
  wrapInHeadingCommand,
  wrapInBulletListCommand,
  wrapInOrderedListCommand,
  wrapInBlockquoteCommand,
  insertHrCommand,
} from "@milkdown/kit/preset/commonmark"
import { TextSelection } from "@milkdown/kit/prose/state"
import type { Node } from "@milkdown/kit/prose/model"

export class SlashView {
  provider: SlashProvider
  content: HTMLElement
  private view: EditorView
  private milkdownCtx: Ctx
  private activeIndex = 0
  private handleKeydown: (e: KeyboardEvent) => void
  private slashFrom: number | null = null

  constructor(view: EditorView, ctx: Ctx) {
    this.view = view
    this.milkdownCtx = ctx
    this.content = document.createElement("div")
    this.content.className = "milkdown-slash"
    this.content.dataset.show = "false"
    this.content.innerHTML = `
      <div data-cmd="heading" data-level="1">Heading 1</div>
      <div data-cmd="heading" data-level="2">Heading 2</div>
      <div data-cmd="heading" data-level="3">Heading 3</div>
      <div data-cmd="bullet_list">Bullet list</div>
      <div data-cmd="ordered_list">Ordered list</div>
      <div data-cmd="blockquote">Blockquote</div>
      <div data-cmd="thematic_break">Divider</div>
    `

    this.content.addEventListener("mousedown", (e) => {
      const item = (e.target as HTMLElement).closest("[data-cmd]") as HTMLElement
      if (!item) return
      e.preventDefault()
      this.execute(item)
    })

    this.handleKeydown = (e: KeyboardEvent) => {
      if (this.content.dataset.show !== "true") return

      const items = this.content.querySelectorAll<HTMLElement>("[data-cmd]")
      if (items.length === 0) return

      if (e.key === "ArrowDown") {
        e.preventDefault()
        e.stopPropagation()
        this.activeIndex = (this.activeIndex + 1) % items.length
        this.highlight(items)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        e.stopPropagation()
        this.activeIndex = (this.activeIndex - 1 + items.length) % items.length
        this.highlight(items)
      } else if (e.key === "Enter") {
        e.preventDefault()
        e.stopPropagation()
        const item = items[this.activeIndex]
        if (item) this.execute(item)
      } else if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        this.provider.hide()
      }
    }

    document.addEventListener("keydown", this.handleKeydown, true)

    this.provider = new SlashProvider({
      content: this.content,
      shouldShow: (v) => {
        const { selection } = v.state
        const { empty, $from } = selection
        if (!empty || !v.editable) return false
        const textBefore = $from.parent.textBetween(
          Math.max(0, $from.parentOffset - 1),
          $from.parentOffset,
        )
        return textBefore === "/"
      },
    })

    this.provider.onShow = () => {
      this.slashFrom = this.view.state.selection.from
      const items = this.content.querySelectorAll<HTMLElement>("[data-cmd]")
      this.activeIndex = 0
      this.highlight(items)
    }
  }

  update(view: EditorView, prevState?: EditorState) {
    this.view = view
    this.provider.update(view, prevState)
  }

  destroy() {
    document.removeEventListener("keydown", this.handleKeydown, true)
    this.provider.destroy()
  }

  private execute(item: HTMLElement) {
    const cmd = item.dataset.cmd!
    const level = parseInt(item.dataset.level || "0")
    const view = this.milkdownCtx.get(editorViewCtx)

    if (this.slashFrom != null && this.slashFrom > 0) {
      view.dispatch(view.state.tr.delete(this.slashFrom - 1, this.slashFrom))
      this.slashFrom = null
    }

    const { state } = view
    const { schema, selection } = state
    const { $from } = selection

    if ($from.parent.content.size === 0) {
      let parentType: string | null = null
      let parentDepth = 0
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d)
        if (node.type === schema.nodes.bullet_list ||
            node.type === schema.nodes.ordered_list ||
            node.type === schema.nodes.blockquote) {
          parentType = node.type.name
          parentDepth = d
          break
        }
      }
      const isHeading = $from.parent.type === schema.nodes.heading

      if (parentType || isHeading) {
        this.replaceBlock(cmd, level, view, parentType, parentDepth, isHeading)
        return
      }
    }

    if (cmd === "thematic_break") {
      this.insertBelow(cmd, level, view)
      view.focus()
      return
    }

    const commands = this.milkdownCtx.get(commandsCtx)
    commands.call(
      cmd === "heading" ? wrapInHeadingCommand.key :
      cmd === "bullet_list" ? wrapInBulletListCommand.key :
      cmd === "ordered_list" ? wrapInOrderedListCommand.key :
      wrapInBlockquoteCommand.key,
      cmd === "heading" ? level : undefined,
    )
    view.focus()
  }

  private replaceBlock(
    cmd: string,
    level: number,
    view: EditorView,
    parentType: string | null,
    parentDepth: number,
    isHeading: boolean,
  ) {
    const { state, dispatch } = view
    const { schema, selection } = state
    const { $from } = selection

    if (cmd === "thematic_break") {
      this.insertBelow(cmd, level, view)
      return
    }

    if (parentType === "bullet_list" && cmd === "ordered_list") {
      const pos = $from.before(parentDepth)
      const node = $from.node(parentDepth)
      dispatch(state.tr.replaceWith(pos, pos + node.nodeSize, schema.nodes.ordered_list.create(null, node.content)))
      return
    }
    if (parentType === "ordered_list" && cmd === "bullet_list") {
      const pos = $from.before(parentDepth)
      const node = $from.node(parentDepth)
      dispatch(state.tr.replaceWith(pos, pos + node.nodeSize, schema.nodes.bullet_list.create(null, node.content)))
      return
    }

    if (parentType === "blockquote" && cmd === "blockquote") return

    if (cmd === "heading") {
      const heading = schema.nodes.heading.create({ level })
      if (parentType) {
        const pos = $from.before(parentDepth)
        dispatch(state.tr.replaceWith(pos, pos + $from.node(parentDepth).nodeSize, heading))
      } else {
        const pos = $from.before($from.depth)
        dispatch(state.tr.replaceWith(pos, pos + $from.node($from.depth).nodeSize, heading))
      }
      return
    }

    if (isHeading) {
      const pos = $from.before($from.depth)
      const para = schema.nodes.paragraph.create()
      let newBlock: Node
      if (cmd === "bullet_list") {
        newBlock = schema.nodes.bullet_list.create(null, schema.nodes.list_item.create(null, para))
      } else if (cmd === "ordered_list") {
        newBlock = schema.nodes.ordered_list.create(null, schema.nodes.list_item.create(null, para))
      } else {
        newBlock = schema.nodes.blockquote.create(null, para)
      }
      dispatch(state.tr.replaceWith(pos, pos + $from.node($from.depth).nodeSize, newBlock))
      return
    }

    if (parentType) {
      const pos = $from.before(parentDepth)
      const para = schema.nodes.paragraph.create()
      let newBlock: Node
      if (cmd === "bullet_list") {
        newBlock = schema.nodes.bullet_list.create(null, schema.nodes.list_item.create(null, para))
      } else if (cmd === "ordered_list") {
        newBlock = schema.nodes.ordered_list.create(null, schema.nodes.list_item.create(null, para))
      } else {
        newBlock = schema.nodes.blockquote.create(null, para)
      }
      dispatch(state.tr.replaceWith(pos, pos + $from.node(parentDepth).nodeSize, newBlock))
      return
    }

    this.insertBelow(cmd, level, view)
  }

  private insertBelow(cmd: string, level: number, view: EditorView) {
    const { state, dispatch } = view
    const { schema, selection } = state
    const { $from } = selection
    const afterPos = $from.after($from.depth)

    if (cmd === "heading") {
      const heading = schema.nodes.heading.create({ level })
      const tr = state.tr.insert(afterPos, heading)
      dispatch(tr.setSelection(TextSelection.create(tr.doc, afterPos + 1)))
      return
    }

    if (cmd === "thematic_break") {
      const hr = schema.nodes.hr.create()
      const para = schema.nodes.paragraph.create()
      const tr = state.tr.insert(afterPos, hr).insert(afterPos + 2, para)
      dispatch(tr.setSelection(TextSelection.create(tr.doc, afterPos + 3)))
      return
    }

    const para = schema.nodes.paragraph.create()
    let newBlock: Node

    if (cmd === "bullet_list") {
      newBlock = schema.nodes.bullet_list.create(null, schema.nodes.list_item.create(null, para))
    } else if (cmd === "ordered_list") {
      newBlock = schema.nodes.ordered_list.create(null, schema.nodes.list_item.create(null, para))
    } else {
      newBlock = schema.nodes.blockquote.create(null, para)
    }

    const tr = state.tr.insert(afterPos, newBlock)
    const insEnd = afterPos + newBlock.nodeSize
    const selPos = cmd === "blockquote" ? afterPos + 2 : afterPos + 3
    dispatch(tr.setSelection(TextSelection.create(tr.doc, selPos)))
  }

  private highlight(items: NodeListOf<HTMLElement>) {
    for (let i = 0; i < items.length; i++) {
      items[i].style.background = i === this.activeIndex ? "#e5e9f0" : ""
    }
  }
}
