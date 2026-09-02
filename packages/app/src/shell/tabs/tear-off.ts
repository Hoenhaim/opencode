import { Schema } from "effect"
import { Persistence } from "@/runtime/persistence/schema"
import { TabStorage } from "./schema"

export function canMoveTabToNewWindow(input: { tabCount: number; pending?: boolean }) {
  if (input.pending) return false
  return input.tabCount >= 2
}

export function windowTabStorageName(windowID: string) {
  return `opencode.window.${windowID.replace(/[^a-zA-Z0-9._-]/g, "-")}.dat`
}

export function serializeWindowTabSeed(input: {
  tab: typeof TabStorage.Tab.Type
  key: string
  info?: typeof TabStorage.Info.Type
  panes?: (typeof TabStorage.Panes.Type)[string]
}) {
  return {
    tabs: encode(TabStorage.Tabs, [], [input.tab]),
    recent: encode(TabStorage.Recent, { key: undefined }, { key: input.key }),
    info: encode(TabStorage.Infos, {}, input.info ? { [input.key]: input.info } : {}),
    panes: encode(TabStorage.Panes, {}, input.panes ? { [input.key]: input.panes } : {}),
  }
}

export async function writeWindowTabSeed(
  storage: { setItem: (key: string, value: string) => unknown },
  seed: ReturnType<typeof serializeWindowTabSeed>,
) {
  await Promise.all([
    storage.setItem("tabs", seed.tabs),
    storage.setItem("tabs.recent", seed.recent),
    storage.setItem("tabs.info", seed.info),
    storage.setItem("tabs.panes", seed.panes),
  ])
}

function encode<S extends Schema.ConstraintCodec<object, unknown>>(schema: S, initial: S["Type"], value: S["Type"]) {
  return Schema.encodeSync(Schema.fromJsonString(Persistence.withInitial(schema, initial)))(value)
}
