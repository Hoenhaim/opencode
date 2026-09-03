import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/unstable/rpc"

export const WindowTabSeed = Schema.Struct({
  tabs: Schema.String,
  recent: Schema.String,
  info: Schema.String,
  panes: Schema.String,
})

export const WindowThemeReady = Rpc.make("WindowThemeReady")
export const WindowGetFocused = Rpc.make("WindowGetFocused", { success: Schema.Boolean })
export const WindowGetFullscreen = Rpc.make("WindowGetFullscreen", { success: Schema.Boolean })
export const WindowSetFocus = Rpc.make("WindowSetFocus")
export const WindowShow = Rpc.make("WindowShow")
export const WindowGetZoomFactor = Rpc.make("WindowGetZoomFactor", { success: Schema.Number })
export const WindowSetZoomFactor = Rpc.make("WindowSetZoomFactor", {
  payload: { factor: Schema.Number },
})
export const WindowGetPinchZoomEnabled = Rpc.make("WindowGetPinchZoomEnabled", {
  success: Schema.Boolean,
})
export const WindowSetPinchZoomEnabled = Rpc.make("WindowSetPinchZoomEnabled", {
  payload: { enabled: Schema.Boolean },
})
export const WindowSetTitlebar = Rpc.make("WindowSetTitlebar", {
  payload: {
    theme: Schema.Struct({
      mode: Schema.Literals(["light", "dark"]),
      scheme: Schema.optionalKey(Schema.Literals(["system", "light", "dark"])),
    }),
  },
})
export const WindowCreate = Rpc.make("WindowCreate", {
  payload: {
    id: Schema.String,
    placement: Schema.Literals(["cursor", "offset"]),
    follow: Schema.optionalKey(Schema.Boolean),
    followOffsetX: Schema.optionalKey(Schema.Number),
    followOffsetY: Schema.optionalKey(Schema.Number),
  },
  success: Schema.String,
})
export const WindowClose = Rpc.make("WindowClose", {
  payload: { id: Schema.String },
})
export const WindowFollowStop = Rpc.make("WindowFollowStop", {
  payload: { id: Schema.String },
})
export const WindowFollowSetVisible = Rpc.make("WindowFollowSetVisible", {
  payload: { id: Schema.String, visible: Schema.Boolean },
})
export const WindowIsFollowing = Rpc.make("WindowIsFollowing", {
  success: Schema.Boolean,
})
export const WindowTabBarAtCursor = Rpc.make("WindowTabBarAtCursor", {
  payload: { exclude: Schema.Array(Schema.String) },
  success: Schema.NullOr(
    Schema.Struct({
      id: Schema.String,
      screenX: Schema.Number,
    }),
  ),
})
export const WindowTransferTab = Rpc.make("WindowTransferTab", {
  payload: {
    targetID: Schema.String,
    seed: WindowTabSeed,
    screenX: Schema.optionalKey(Schema.Number),
  },
})
export const WindowRpcs = RpcGroup.make(
  WindowThemeReady,
  WindowGetFocused,
  WindowGetFullscreen,
  WindowSetFocus,
  WindowShow,
  WindowGetZoomFactor,
  WindowSetZoomFactor,
  WindowGetPinchZoomEnabled,
  WindowSetPinchZoomEnabled,
  WindowSetTitlebar,
  WindowCreate,
  WindowClose,
  WindowFollowStop,
  WindowFollowSetVisible,
  WindowIsFollowing,
  WindowTabBarAtCursor,
  WindowTransferTab,
)
