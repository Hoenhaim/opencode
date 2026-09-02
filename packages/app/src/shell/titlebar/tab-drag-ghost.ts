export function tabDragRoot() {
  return document.getElementById("root") ?? document.documentElement
}

export function setTabDragging(active: boolean) {
  const root = tabDragRoot()
  if (active) {
    root.setAttribute("data-tab-dragging", "true")
    return
  }
  root.removeAttribute("data-tab-dragging")
}

export function createTabDragGhost(source: HTMLElement) {
  const tab = source.querySelector<HTMLElement>("[data-titlebar-tab]") ?? source
  const ghost = tab.cloneNode(true) as HTMLElement
  ghost.removeAttribute("id")
  ghost.removeAttribute("popover")
  ghost.removeAttribute("data-dnd-dragging")
  ghost.removeAttribute("data-dnd-dropping")
  ghost.removeAttribute("data-dnd-placeholder")
  ghost.setAttribute("data-titlebar-tab-ghost", "true")
  ghost.setAttribute("aria-hidden", "true")
  ghost.style.cssText = ""
  ghost.style.position = "fixed"
  ghost.style.top = "0"
  ghost.style.left = "0"
  ghost.style.margin = "0"
  ghost.style.width = `${tab.getBoundingClientRect().width}px`
  ghost.style.zIndex = "2147483646"
  ghost.style.pointerEvents = "none"
  ghost.style.transform = "translate(-9999px, -9999px)"
  document.body.append(ghost)
  return ghost
}

export function moveTabDragGhost(ghost: HTMLElement, x: number, y: number) {
  ghost.style.transform = `translate(${x}px, ${y}px)`
}

export function removeTabDragGhost(ghost: HTMLElement | undefined) {
  ghost?.remove()
}
