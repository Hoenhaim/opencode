import { configurator, Modifier } from "@dnd-kit/abstract"
import { DragDropManager } from "@dnd-kit/dom"

type TabStripModifierOptions = {
  detached: () => boolean
  orientation: () => "horizontal" | "vertical"
  element: () => HTMLElement | undefined
}

class RestrictTabDragToStrip extends Modifier<DragDropManager, TabStripModifierOptions> {
  // Keep reorder in the strip until the pointer leaves it, then follow the cursor
  // so the tab can be dropped back (remerge) or released into a new window.
  apply(operation: {
    transform: { x: number; y: number }
    shape: {
      initial: { center: { x: number; y: number } }
      current: { boundingRectangle: { width: number; height: number } }
    } | null
  }) {
    const transform = operation.transform
    if (this.options?.detached()) return transform
    const next = this.options?.orientation() === "vertical" ? { x: 0, y: transform.y } : { x: transform.x, y: 0 }
    const element = this.options?.element()
    const shape = operation.shape
    if (!element || !shape) return next
    const rect = element.getBoundingClientRect()
    const width = shape.current.boundingRectangle.width
    const height = shape.current.boundingRectangle.height
    const left = shape.initial.center.x - width / 2
    const top = shape.initial.center.y - height / 2
    return {
      x: clampDelta(left, left + width, next.x, rect.left, rect.width),
      y: clampDelta(top, top + height, next.y, rect.top, rect.height),
    }
  }
}

export const restrictTabDragToStrip = configurator(RestrictTabDragToStrip)

function clampDelta(start: number, end: number, delta: number, min: number, size: number) {
  if (start + delta <= min) return min - start
  if (end + delta >= min + size) return min + size - end
  return delta
}
