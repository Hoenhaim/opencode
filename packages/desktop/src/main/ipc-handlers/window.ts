import { BrowserWindow, screen } from "electron"
import { Effect } from "effect"
import { WindowRpcs } from "../../shared/ipc-rpc"
import { IpcPortHandoff } from "../ipc-transport"
import { ApplicationLifecycle } from "../lifecycle"
import { getPinchZoomEnabled, setPinchZoomEnabled, setTitlebar, setWindowThemeReady, updateTitlebar, windowByID } from "../windows"
import { startWindowFollow, stopWindowFollow } from "../windows/follow"
import { TEAR_OFF_WINDOW_OFFSET, tearOffWindowBounds } from "../windows/tear-off"
import { sender } from "./context"

export const windowHandlers = WindowRpcs.toLayer(
  Effect.gen(function* () {
    const handoff = yield* IpcPortHandoff
    const lifecycle = yield* ApplicationLifecycle.Service
    return WindowRpcs.of({
      WindowThemeReady: (_args, context) =>
        Effect.sync(() => {
          const win = BrowserWindow.fromWebContents(sender(handoff, context))
          if (!win) throw new Error("Window not found")
          setWindowThemeReady(win)
        }),
      WindowGetFocused: (_args, context) =>
        Effect.sync(() => BrowserWindow.fromWebContents(sender(handoff, context))?.isFocused() ?? false),
      WindowGetFullscreen: (_args, context) =>
        Effect.sync(() => BrowserWindow.fromWebContents(sender(handoff, context))?.isFullScreen() ?? false),
      WindowSetFocus: (_args, context) =>
        Effect.sync(() => BrowserWindow.fromWebContents(sender(handoff, context))?.focus()),
      WindowShow: (_args, context) =>
        Effect.sync(() => BrowserWindow.fromWebContents(sender(handoff, context))?.show()),
      WindowGetZoomFactor: (_args, context) => Effect.sync(() => sender(handoff, context).getZoomFactor()),
      WindowSetZoomFactor: ({ factor }, context) =>
        Effect.sync(() => {
          const contents = sender(handoff, context)
          contents.setZoomFactor(factor)
          const win = BrowserWindow.fromWebContents(contents)
          if (win) updateTitlebar(win)
        }),
      WindowGetPinchZoomEnabled: () => Effect.sync(getPinchZoomEnabled),
      WindowSetPinchZoomEnabled: ({ enabled }) => Effect.sync(() => setPinchZoomEnabled(enabled)),
      WindowSetTitlebar: ({ theme }, context) =>
        Effect.sync(() => {
          const win = BrowserWindow.fromWebContents(sender(handoff, context))
          if (win) setTitlebar(win, theme)
        }),
      WindowCreate: ({ id, placement, follow }, context) =>
        Effect.sync(() => {
          if (!id) throw new Error("Window ID is required")
          const source = BrowserWindow.fromWebContents(sender(handoff, context))
          if (!source || source.isDestroyed()) throw new Error("Window not found")
          const origin = source.getNormalBounds()
          const cursor = screen.getCursorScreenPoint()
          const point =
            placement === "cursor"
              ? cursor
              : { x: origin.x + TEAR_OFF_WINDOW_OFFSET, y: origin.y + TEAR_OFF_WINDOW_OFFSET }
          const win = lifecycle.createWindow(
            id,
            tearOffWindowBounds({
              source: origin,
              placement,
              cursor,
              workArea: screen.getDisplayNearestPoint(point).workArea,
            }),
          )
          if (follow) startWindowFollow(win, id)
          return id
        }),
      WindowClose: ({ id }) =>
        Effect.sync(() => {
          const win = windowByID(id)
          stopWindowFollow(id, win)
          if (win && !win.isDestroyed()) win.close()
        }),
      WindowFollowStop: ({ id }) =>
        Effect.sync(() => {
          stopWindowFollow(id, windowByID(id))
        }),
    })
  }),
)
