import { BrowserWindow, screen } from "electron"

const following = new Map<string, ReturnType<typeof setInterval>>()

export function startWindowFollow(win: BrowserWindow, id: string) {
  stopWindowFollow(id)
  win.setAlwaysOnTop(true, "floating")
  win.setIgnoreMouseEvents(true)
  const place = () => {
    if (win.isDestroyed()) {
      stopWindowFollow(id)
      return
    }
    const cursor = screen.getCursorScreenPoint()
    const bounds = win.getBounds()
    win.setPosition(cursor.x - Math.min(160, Math.round(bounds.width * 0.15)), cursor.y - 22, false)
  }
  place()
  following.set(id, setInterval(place, 16))
  if (!win.isDestroyed()) win.showInactive()
}

export function stopWindowFollow(id: string, win?: BrowserWindow | null) {
  const timer = following.get(id)
  if (timer) clearInterval(timer)
  following.delete(id)
  if (!win || win.isDestroyed()) return
  win.setAlwaysOnTop(false)
  win.setIgnoreMouseEvents(false)
}
