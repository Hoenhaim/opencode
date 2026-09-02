import { createEffect, createMemo, createResource, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { DragDropProvider, PointerSensor } from "@dnd-kit/solid"
import { isSortable, useSortable } from "@dnd-kit/solid/sortable"
import { Accessibility, AutoScroller, Feedback, PointerActivationConstraints } from "@dnd-kit/dom"
import { arrayMove } from "@dnd-kit/helpers"
import { tabHref, tabKey, useTabs, type SessionTab, type Tab } from "@/shell/tabs/tabs"
import { usePlatform } from "@/runtime/platform/platform"
import { ServerConnection } from "@/runtime/server/registry"
import { DraftTabItem, TabNavItem } from "@/shell/titlebar/tab-nav"
import { useGlobal, useServerCtx, type ServerCtx } from "@/runtime/server/runtime"
import { useLanguage } from "@/runtime/i18n/language"
import { useCommand } from "@/shell/commands/command"
import { createTabComposerState } from "@/composer/persistence"
import { base64Encode } from "@opencode-ai/util/encode"
import { showToast } from "@/shell/notifications/toast"
import { canMoveTabToNewWindow } from "@/shell/tabs/tear-off"
import { createTabDragGhost, moveTabDragGhost, removeTabDragGhost, setTabDragging } from "./tab-drag-ghost"
import {
  canStartTabDrag,
  isPointerOnTabBar,
  isPointerOutsideWindow,
  isTabCloseTarget,
  nextTearOffDetached,
} from "./tab-gesture"
import { restrictTabDragToStrip } from "./tab-strip-modifier"
import { adjacentTabKey, mergeVisibleTabOrder } from "./tab-order"
import type { SessionInfo } from "@opencode-ai/client/promise"

function SessionTabSlot(props: {
  tab: SessionTab
  id: string
  index: number
  active: boolean
  orientation: "horizontal" | "vertical"
  session: SessionInfo | undefined
  preparing: boolean
  fallbackTitle?: string
  onRename: (title: string) => Promise<void>
  onNavigate: (element: HTMLDivElement) => void
  onClose: () => void
  onMoveToNewWindow?: () => void
  moveToNewWindowDisabled?: boolean
  tearOff?: boolean
}) {
  const sortable = useSortable({
    get id() {
      return props.id
    },
    get index() {
      return props.index
    },
  })
  let ref!: HTMLDivElement

  return (
    <div
      ref={sortable.ref}
      data-titlebar-tab-slot
      data-tab-key={props.id}
      data-active={props.active}
      data-orientation={props.orientation}
      data-tear-off={props.tearOff && sortable.isDragSource() ? "true" : undefined}
      class="relative flex"
      classList={{
        "w-56 min-w-7 max-w-56 flex-shrink": props.orientation === "horizontal",
        "w-full shrink-0": props.orientation === "vertical",
      }}
    >
      <TabNavItem
        ref={(el) => {
          ref = el
        }}
        href={tabHref(props.tab)}
        server={props.tab.server}
        session={props.session}
        preparing={props.preparing}
        fallbackTitle={props.fallbackTitle}
        onRename={props.onRename}
        onNavigate={() => props.onNavigate(ref)}
        onClose={props.onClose}
        onMoveToNewWindow={props.onMoveToNewWindow}
        moveToNewWindowDisabled={props.moveToNewWindowDisabled}
        active={props.active}
        dragging={sortable.isDragSource()}
        orientation={props.orientation}
      />
    </div>
  )
}

function SessionTabEntry(props: {
  tab: SessionTab
  id: string
  index: number
  active: boolean
  orientation: "horizontal" | "vertical"
  serverCtx: ServerCtx | undefined
  onVisibleChange: (visible: boolean) => void
  onNavigate: (element: HTMLDivElement) => void
  onClose: () => void
  onMoveToNewWindow?: () => void
  moveToNewWindowDisabled?: boolean
  tearOff?: boolean
}) {
  const tabs = useTabs()
  const language = useLanguage()
  const sdk = createMemo(() => props.serverCtx?.sdk ?? null)
  const pending = createMemo(() => tabs.pendingSession(props.tab.server, props.tab.sessionId))
  const cachedSession = createMemo(() => props.serverCtx?.data.session.get(props.tab.sessionId))
  const persisted = createMemo(() => tabs.info[props.id])
  const [loadedSession] = createResource(
    () => {
      if (pending()) return null
      const ctx = props.serverCtx
      return ctx ? { id: props.tab.sessionId, ctx } : null
    },
    ({ id, ctx }) =>
      ctx.data.session
        .sync(id)
        .then(() => ctx.data.session.get(id))
        .catch(() => undefined),
  )
  const session = createMemo(() => (pending() ? undefined : (cachedSession() ?? loadedSession())))
  const missingSession = createMemo(() => !pending() && !!props.serverCtx && !loadedSession.loading && !session())
  const visible = createMemo(() => !!pending() || !!session() || missingSession() || !!persisted()?.title)

  const rename = async (title: string) => {
    const value = session()
    const ctx = props.serverCtx
    if (!value || !ctx) return

    ctx.data.session.remember({ ...value, title })
    try {
      await ctx.sdk.api.session.rename({ sessionID: value.id, title })
    } catch (err) {
      const current = session()
      const currentCtx = props.serverCtx
      if (current && currentCtx) currentCtx.data.session.remember({ ...current, title: value.title })
      showToast({
        title: language.t("common.requestFailed"),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  createEffect(() => props.onVisibleChange(visible()))

  createEffect(() => {
    const ctx = props.serverCtx
    const value = session()
    if (!ctx || !value || props.active || ctx.sdk.connection.status() !== "connected") return
    const timer = window.setTimeout(
      () =>
        void Promise.allSettled([
          ctx.data.session.sync(value.id, { children: true }),
          ctx.data.session.pending.sync(value.id),
          ctx.data.session.message.sync(value.id),
          ctx.data.session.permission.sync(value.id),
          ctx.data.session.form.sync(value.id),
        ]),
      300 + props.index * 50,
    )
    onCleanup(() => window.clearTimeout(timer))
  })

  createEffect(() => {
    const value = session()
    if (!value) return
    tabs.rememberSessionInfo(props.tab, value)
    const current = sdk()
    if (!current) return
    createTabComposerState(tabs, props.tab, current.scope, {
      dir: base64Encode(value.location.directory),
      id: value.id,
    })
  })

  return (
    <Show when={visible()}>
      <SessionTabSlot
        tab={props.tab}
        id={props.id}
        index={props.index}
        active={props.active}
        orientation={props.orientation}
        session={session()}
        preparing={!!pending()}
        fallbackTitle={
          pending()
            ? language.t("command.session.new")
            : (persisted()?.title ?? (missingSession() ? language.t("session.tab.unknown") : undefined))
        }
        onRename={rename}
        onNavigate={props.onNavigate}
        onClose={props.onClose}
        onMoveToNewWindow={props.onMoveToNewWindow}
        moveToNewWindowDisabled={props.moveToNewWindowDisabled}
        tearOff={props.tearOff}
      />
    </Show>
  )
}

function DraftTabSlot(props: {
  tab: Extract<Tab, { type: "draft" }>
  id: string
  index: number
  active: boolean
  orientation: "horizontal" | "vertical"
  title: string
  onNavigate: (element: HTMLDivElement) => void
  onClose: () => void
  onMoveToNewWindow?: () => void
  moveToNewWindowDisabled?: boolean
  tearOff?: boolean
}) {
  const sortable = useSortable({
    get id() {
      return props.id
    },
    get index() {
      return props.index
    },
  })
  let ref!: HTMLDivElement

  return (
    <div
      ref={sortable.ref}
      data-titlebar-tab-slot
      data-tab-key={props.id}
      data-active={props.active}
      data-orientation={props.orientation}
      data-tear-off={props.tearOff && sortable.isDragSource() ? "true" : undefined}
      class="relative flex"
      classList={{
        "w-56 min-w-7 max-w-56 flex-shrink": props.orientation === "horizontal",
        "w-full shrink-0": props.orientation === "vertical",
      }}
    >
      <DraftTabItem
        ref={(el) => {
          ref = el
        }}
        href={tabHref(props.tab)}
        title={props.title}
        onNavigate={() => props.onNavigate(ref)}
        onClose={props.onClose}
        onMoveToNewWindow={props.onMoveToNewWindow}
        moveToNewWindowDisabled={props.moveToNewWindowDisabled}
        active={props.active}
        dragging={sortable.isDragSource()}
        orientation={props.orientation}
      />
    </div>
  )
}

export function TitlebarTabStrip(props: {
  orientation?: "horizontal" | "vertical"
  tabs: Tab[]
  currentTab: Tab | undefined
  onNavigate: (tab: Tab, el?: HTMLDivElement) => void
  onClose: (tab: Tab) => void
  onReorder: (keys: string[]) => void
  onMoveToNewWindow?: (tab: Tab, placement: "cursor" | "offset") => void
}) {
  const global = useGlobal()
  const language = useLanguage()
  const command = useCommand()
  const tabs = useTabs()
  const platform = usePlatform()
  const vertical = () => props.orientation === "vertical"
  let listRef!: HTMLDivElement
  const drag = {
    x: 0,
    y: 0,
    grabX: 0,
    grabY: 0,
    detached: false,
    enabled: false,
    followID: undefined as string | undefined,
    followPending: false,
    live: false,
    tab: undefined as Tab | undefined,
    ghost: undefined as HTMLElement | undefined,
    stop: undefined as undefined | (() => void),
  }
  const [visibility, setVisibility] = createStore<Record<string, boolean>>({})
  const [tearOff, setTearOff] = createStore({ detached: false })
  const visibleTabs = createMemo(() => props.tabs.filter((tab) => tab.type === "draft" || visibility[tabKey(tab)]))
  const visibleTabIds = () => visibleTabs().map(tabKey)

  command.register("titlebar-tab-cycle", () => [
    {
      id: `tab.prev`,
      category: "tab",
      title: "",
      keybind: `mod+option+ArrowLeft,ctrl+shift+tab`,
      hidden: true,
      onSelect: () => selectAdjacentTab(-1),
    },
    {
      id: `tab.next`,
      category: "tab",
      title: "",
      keybind: `mod+option+ArrowRight,ctrl+tab`,
      hidden: true,
      onSelect: () => selectAdjacentTab(1),
    },
  ])

  function selectAdjacentTab(offset: -1 | 1) {
    const current = props.currentTab
    const key = adjacentTabKey(visibleTabIds(), current ? tabKey(current) : undefined, offset)
    const next = props.tabs.find((tab) => tabKey(tab) === key)
    if (next) props.onNavigate(next)
  }

  function moveDisabled(tab: Tab) {
    return !canMoveTabToNewWindow({
      tabCount: props.tabs.length,
      pending: tab.type === "session" && !!tabs.pendingSession(tab.server, tab.sessionId),
    })
  }

  onCleanup(() => {
    drag.stop?.()
    removeTabDragGhost(drag.ghost)
    setTabDragging(false)
  })

  return (
    <div
      data-slot={vertical() ? "vertical-tabs" : "titlebar-tabs"}
      data-orientation={vertical() ? "vertical" : "horizontal"}
      class="relative min-w-0"
      classList={{ "min-h-0 overflow-hidden": vertical() && !tearOff.detached }}
    >
      <div
        data-slot={vertical() ? "vertical-tabs-scroll" : "titlebar-tabs-scroll"}
        class="flex min-w-0 no-scrollbar [app-region:no-drag]"
        classList={{
          "flex-row items-center gap-1.5": !vertical(),
          "overflow-x-auto": !vertical() && !tearOff.detached,
          "overflow-visible": tearOff.detached,
          "max-h-full flex-col": vertical(),
          "overflow-y-auto overflow-x-hidden": vertical() && !tearOff.detached,
        }}
      >
        <DragDropProvider
          sensors={[
            PointerSensor.configure({
              activationConstraints: [new PointerActivationConstraints.Distance({ value: 4 })],
              preventActivation: (event) =>
                !canStartTabDrag(event.pointerType) ||
                isTabCloseTarget(event.target) ||
                (event.target instanceof Element && !!event.target.closest('[contenteditable="true"]')),
            }),
          ]}
          modifiers={[
            restrictTabDragToStrip({
              detached: () => drag.detached,
              orientation: () => (vertical() ? "vertical" : "horizontal"),
              element: () => listRef,
            }),
          ]}
          plugins={(defaults) => [
            ...defaults.filter((plugin) => plugin !== Accessibility),
            AutoScroller.configure({ acceleration: 8, threshold: vertical() ? { x: 0, y: 0.05 } : { x: 0.05, y: 0 } }),
            Feedback.configure({ dropAnimation: null }),
          ]}
          onDragStart={(event) => {
            const source = event.operation.source
            const origin = source?.element?.getBoundingClientRect()
            const activator = event.operation.activatorEvent
            const pointerX = activator instanceof PointerEvent ? activator.clientX : origin?.left ?? 0
            const pointerY = activator instanceof PointerEvent ? activator.clientY : origin?.top ?? 0
            drag.x = pointerX
            drag.y = pointerY
            drag.grabX = origin ? pointerX - origin.left : 0
            drag.grabY = origin ? pointerY - origin.top : 0
            drag.detached = false
            drag.followID = undefined
            drag.followPending = false
            drag.live = true
            setTearOff("detached", false)
            setTabDragging(true)
            const tab = source ? props.tabs.find((item) => tabKey(item) === source.id.toString()) : undefined
            drag.tab = tab
            drag.enabled = !!tab && !!props.onMoveToNewWindow && !moveDisabled(tab)
            const move = (pointer: PointerEvent) => {
              drag.x = pointer.clientX
              drag.y = pointer.clientY
              const orientation = vertical() ? "vertical" : "horizontal"
              const onBar = isPointerOnTabBar(drag.x, drag.y, orientation)
              const outside = isPointerOutsideWindow(drag.x, drag.y)
              const currentTab = drag.tab
              if (outside && drag.enabled && currentTab && !drag.followID && !drag.followPending) {
                const index = props.tabs.findIndex((item) => tabKey(item) === tabKey(currentTab))
                if (index !== -1) {
                  drag.followPending = true
                  void tabs
                    .moveToNewWindow(index, "cursor", { follow: true, remove: false })
                    .then((id) => {
                      drag.followPending = false
                      if (!id) return
                      if (!drag.live) {
                        if (isPointerOnTabBar(drag.x, drag.y, orientation)) {
                          void platform.closeWindow?.(id)
                          return
                        }
                        void platform.stopWindowFollow?.(id)
                        if (index !== -1) tabs.removeTab(index)
                        return
                      }
                      drag.followID = id
                      removeTabDragGhost(drag.ghost)
                      drag.ghost = undefined
                    })
                    .catch(() => {
                      drag.followPending = false
                    })
                }
              }
              if (onBar && drag.followID && platform.closeWindow) {
                const id = drag.followID
                drag.followID = undefined
                void platform.closeWindow(id)
              }
              if (drag.ghost && !drag.followID) moveTabDragGhost(drag.ghost, drag.x - drag.grabX, drag.y - drag.grabY)
              if (!listRef) return
              const next = nextTearOffDetached({
                detached: drag.detached,
                overStrip: onBar,
                pointer: { x: drag.x, y: drag.y },
                strip: listRef.getBoundingClientRect(),
                orientation,
              })
              if (next === drag.detached) return
              drag.detached = next
              setTearOff("detached", next)
              if (next && source?.element instanceof HTMLElement && !drag.ghost && !drag.followID) {
                drag.ghost = createTabDragGhost(source.element)
                moveTabDragGhost(drag.ghost, drag.x - drag.grabX, drag.y - drag.grabY)
                return
              }
              if (!next) {
                removeTabDragGhost(drag.ghost)
                drag.ghost = undefined
              }
            }
            drag.stop?.()
            document.addEventListener("pointermove", move, { capture: true })
            document.addEventListener("pointerup", move, { capture: true })
            drag.stop = () => {
              document.removeEventListener("pointermove", move, { capture: true })
              document.removeEventListener("pointerup", move, { capture: true })
              drag.stop = undefined
            }
            if (!tab) return
            const tabEl = source?.element?.querySelector<HTMLDivElement>("[data-titlebar-tab]")
            props.onNavigate(tab, tabEl ?? undefined)
          }}
          onDragEnd={(event) => {
            const orientation = vertical() ? "vertical" : "horizontal"
            const onBar = isPointerOnTabBar(drag.x, drag.y, orientation)
            const detached = drag.detached && !onBar
            const enabled = drag.enabled
            const followID = drag.followID
            const tab = drag.tab
            drag.stop?.()
            removeTabDragGhost(drag.ghost)
            drag.ghost = undefined
            drag.detached = false
            drag.enabled = false
            drag.followID = undefined
            drag.tab = undefined
            drag.live = false
            setTearOff("detached", false)
            setTabDragging(false)
            const current = visibleTabIds()
            const source = event.operation.source
            if (event.canceled || !isSortable(source)) {
              if (followID) void platform.closeWindow?.(followID)
              return
            }
            if (followID) {
              if (onBar) {
                void platform.closeWindow?.(followID)
                return
              }
              void platform.stopWindowFollow?.(followID)
              const index = tab ? props.tabs.findIndex((item) => tabKey(item) === tabKey(tab)) : -1
              if (index !== -1) tabs.removeTab(index)
              return
            }
            if (tab && detached && enabled && props.onMoveToNewWindow) {
              props.onMoveToNewWindow(tab, "cursor")
              return
            }

            const { initialIndex, index } = source
            if (initialIndex !== index) {
              props.onReorder(
                mergeVisibleTabOrder(
                  props.tabs.map(tabKey),
                  current,
                  arrayMove(current, source.initialIndex, source.index),
                ),
              )
            }
          }}
        >
          <div
            data-titlebar-tab-list
            data-orientation={vertical() ? "vertical" : "horizontal"}
            class="flex w-full min-w-0"
            classList={{ "flex-row items-center": !vertical(), "flex-col items-stretch": vertical() }}
            ref={listRef}
          >
            <For each={props.tabs}>
              {(tab) => {
                const id = tabKey(tab)
                let ref!: HTMLDivElement
                const visibleIndex = () => visibleTabs().findIndex((item) => tabKey(item) === id)
                useTabShortcut(visibleIndex, () => props.onNavigate(tab, ref))
                const serverCtx = useServerCtx(() => {
                  if (tab.type !== "session") return
                  return global.servers.list().find((item) => ServerConnection.key(item) === tab.server)
                })

                if (tab.type === "session") {
                  return (
                    <SessionTabEntry
                      tab={tab}
                      id={id}
                      index={visibleIndex()}
                      active={props.currentTab === tab}
                      orientation={vertical() ? "vertical" : "horizontal"}
                      serverCtx={serverCtx()}
                      onVisibleChange={(visible) => setVisibility(id, visible)}
                      onNavigate={(element) => {
                        ref = element
                        props.onNavigate(tab, element)
                      }}
                      onClose={() => props.onClose(tab)}
                      onMoveToNewWindow={
                        props.onMoveToNewWindow ? () => props.onMoveToNewWindow?.(tab, "offset") : undefined
                      }
                      moveToNewWindowDisabled={moveDisabled(tab)}
                      tearOff={tearOff.detached}
                    />
                  )
                }

                return (
                  <DraftTabSlot
                    tab={tab}
                    id={id}
                    index={visibleIndex()}
                    active={props.currentTab === tab}
                    orientation={vertical() ? "vertical" : "horizontal"}
                    title={language.t("command.session.new")}
                    onNavigate={(element) => {
                      ref = element
                      props.onNavigate(tab, element)
                    }}
                    onClose={() => props.onClose(tab)}
                    onMoveToNewWindow={
                      props.onMoveToNewWindow ? () => props.onMoveToNewWindow?.(tab, "offset") : undefined
                    }
                    moveToNewWindowDisabled={moveDisabled(tab)}
                    tearOff={tearOff.detached}
                  />
                )
              }}
            </For>
          </div>
        </DragDropProvider>
      </div>
      <Show when={!vertical()}>
        <div
          data-slot="titlebar-tabs-fade-left"
          aria-hidden="true"
          class="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-[linear-gradient(to_right,var(--v2-background-bg-deep),transparent)]"
        />
        <div
          data-slot="titlebar-tabs-fade-right"
          aria-hidden="true"
          class="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-[linear-gradient(to_left,var(--v2-background-bg-deep),transparent)]"
        />
      </Show>
    </div>
  )
}

function useTabShortcut(index: () => number, onSelect: () => void) {
  const command = useCommand()

  command.register(() => {
    const number = index() + 1
    if (number < 1 || number > 9) return []
    return [
      {
        id: `tab.${number}`,
        category: "tab",
        title: "",
        keybind: `mod+${number}`,
        hidden: true,
        onSelect,
      },
    ]
  })
}
