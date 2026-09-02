import type { Ref } from "solid-js"

export function isTabCloseTarget(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('[data-slot="tab-close"]')
}

export function canStartTabDrag(pointerType: string) {
  return pointerType !== "touch"
}

export function forwardTabRef(ref: Ref<HTMLDivElement> | undefined, element: HTMLDivElement) {
  if (typeof ref === "function") ref(element)
}

export function canOpenTabRename(dragging: boolean | undefined, editing: boolean, pending: boolean) {
  return !dragging && !editing && !pending
}

// Perpendicular distance from the tab strip that counts as tearing the tab off,
// matching browser/WebStorm: horizontal reorder stays in-strip, leaving the
// titlebar (or the vertical strip) creates a window.
export const TAB_TEAR_OFF_DISTANCE = 36

export function isTearOffPointer(
  pointer: { x: number; y: number },
  rect: { top: number; right: number; bottom: number; left: number },
  orientation: "horizontal" | "vertical",
  distance = TAB_TEAR_OFF_DISTANCE,
) {
  if (orientation === "vertical") {
    return pointer.x < rect.left - distance || pointer.x > rect.right + distance
  }
  return pointer.y < rect.top - distance || pointer.y > rect.bottom + distance
}

export function isOverTabStrip(
  pointer: { x: number; y: number },
  rect: { top: number; right: number; bottom: number; left: number },
  slop = 4,
) {
  return (
    pointer.x >= rect.left - slop &&
    pointer.x <= rect.right + slop &&
    pointer.y >= rect.top - slop &&
    pointer.y <= rect.bottom + slop
  )
}

export function isPointerOutsideWindow(x: number, y: number) {
  return x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight
}

export function isPointerOnTabBar(x: number, y: number, orientation: "horizontal" | "vertical") {
  if (isPointerOutsideWindow(x, y)) return false
  if (orientation === "vertical") return x <= 280
  return y <= 52
}

export function nextTearOffDetached(input: {
  detached: boolean
  overStrip: boolean
  pointer: { x: number; y: number }
  strip: { top: number; right: number; bottom: number; left: number }
  orientation: "horizontal" | "vertical"
}) {
  if (input.detached) return !input.overStrip
  return isTearOffPointer(input.pointer, input.strip, input.orientation)
}
