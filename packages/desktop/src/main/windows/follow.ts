import { BrowserWindow, screen } from "electron"

const previewWidth = 420
const previewHeight = 260

type FollowState = {
  win: BrowserWindow
  timer: ReturnType<typeof setInterval>
  bounds: { width: number; height: number }
  visible: boolean
  onShow: () => void
}

const following = new Map<string, FollowState>()

export function startWindowFollow(win: BrowserWindow, id: string, offset?: { x: number; y: number }) {
  stopWindowFollow(id)
  const inset = { x: offset?.x ?? 80, y: offset?.y ?? 18 }
  const bounds = win.getBounds()
  win.setSize(Math.min(previewWidth, bounds.width), Math.min(previewHeight, bounds.height), false)
  win.setAlwaysOnTop(true, "floating")
  win.setIgnoreMouseEvents(true)
  const place = () => {
    if (win.isDestroyed()) {
      stopWindowFollow(id)
      return
    }
    const cursor = screen.getCursorScreenPoint()
    win.setPosition(Math.round(cursor.x - inset.x), Math.round(cursor.y - inset.y), false)
  }
  const state: FollowState = {
    win,
    timer: setInterval(place, 16),
    bounds: { width: bounds.width, height: bounds.height },
    visible: true,
    onShow: () => {
      if (!state.visible) win.hide()
    },
  }
  win.on("show", state.onShow)
  place()
  following.set(id, state)
  if (!win.isDestroyed()) win.showInactive()
}

export function isFollowingWindow(win: BrowserWindow | null) {
  if (!win) return false
  return [...following.values()].some((state) => state.win === win)
}

export function stopWindowFollow(id: string, win?: BrowserWindow | null, restore = true) {
  const state = following.get(id)
  if (state) clearInterval(state.timer)
  following.delete(id)
  if (!win || win.isDestroyed()) return
  if (state) win.removeListener("show", state.onShow)
  win.setAlwaysOnTop(false)
  win.setIgnoreMouseEvents(false)
  if (!state || !restore) return
  const current = win.getBounds()
  const workArea = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  win.setBounds({
    x: clamp(current.x, workArea.x, workArea.x + workArea.width - state.bounds.width),
    y: clamp(current.y, workArea.y, workArea.y + workArea.height - state.bounds.height),
    width: state.bounds.width,
    height: state.bounds.height,
  })
  if (!win.isVisible()) win.show()
}

export function setWindowFollowVisible(id: string, visible: boolean, win?: BrowserWindow | null) {
  const state = following.get(id)
  if (!state || !win || win.isDestroyed() || state.visible === visible) return
  state.visible = visible
  if (!visible) {
    win.hide()
    return
  }
  win.showInactive()
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min
  if (value < min) return min
  if (value > max) return max
  return value
}
