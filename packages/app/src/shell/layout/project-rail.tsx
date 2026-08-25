import { useDirectoryPicker } from "@/workspaces/selection/picker"
import { useSettingsCommand } from "@/settings/command"
import { getProjectAvatarVariant, type LocalProject, useLayout } from "@/shell/state/layout"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { ServerConnection } from "@/runtime/server/registry"
import { useTabs } from "@/shell/tabs/tabs"
import { createHomeController } from "@/home/model"
import { displayName, getProjectAvatarSource, homeProjectDirectories } from "@/shell/layout/helpers"
import { pathKey } from "@/workspaces/path-key"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { ProjectAvatar } from "@opencode-ai/ui/project-avatar"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { createMemo, For, Show } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { DragDropProvider, PointerSensor } from "@dnd-kit/solid"
import { isSortable, useSortable } from "@dnd-kit/solid/sortable"
import { AutoScroller, Feedback, PointerActivationConstraints } from "@dnd-kit/dom"
import { RestrictToVerticalAxis } from "@dnd-kit/abstract/modifiers"
import { RestrictToElement } from "@dnd-kit/dom/modifiers"
import { arrayMove } from "@dnd-kit/helpers"

type RailProject = {
  id: string
  server: ServerConnection.Any
  project: LocalProject
}

export function ProjectRail() {
  const home = createHomeController()
  const layout = useLayout()
  const language = useLanguage()
  const platform = usePlatform()
  const navigate = useNavigate()
  const tabs = useTabs()
  const pickDirectory = useDirectoryPicker()
  const openSettings = useSettingsCommand()
  const tooltipPlacement = () => (language.direction() === "rtl" ? "left" : "right")
  const projects = createMemo(() =>
    home.server.list().flatMap((server) =>
      home.project.forServer(server).map((project) => ({
        id: `${encodeURIComponent(ServerConnection.key(server))}:${encodeURIComponent(project.worktree)}`,
        server,
        project,
      })),
    ),
  )
  const active = createMemo(() => {
    const route = layout.route()
    if (route.type === "home") {
      const selection = home.selection.value()
      return { server: selection.server, directory: selection.directory }
    }
    if (route.type === "draft") {
      const tab = tabs.store.find((item) => item.type === "draft" && item.draftID === route.draftID)
      if (tab?.type === "draft") return { server: tab.server, directory: tab.directory }
      return
    }
    const server = home.server.list().find((item) => ServerConnection.key(item) === route.server)
    const session = server ? home.server.context(server).data.session.get(route.sessionId) : undefined
    return { server: route.server, directory: session?.location.directory }
  })
  const addServer = () => {
    const key = active()?.server ?? home.selection.value().server
    return home.server.list().find((server) => ServerConnection.key(server) === key) ?? home.server.list()[0]
  }
  const addDisabled = () => {
    const server = addServer()
    return !server || home.server.health(server)?.healthy === false
  }

  const chooseProject = () => {
    const server = addServer()
    if (!server || home.server.health(server)?.healthy === false) return
    pickDirectory({
      server,
      title: language.t("command.project.open"),
      multiple: true,
      onSelect: (result) => {
        const directories = homeProjectDirectories(result)
        if (directories.length === 0) return
        home.project.add(server, directories)
        navigate("/")
      },
    })
  }

  return (
    <Show when={layout.projectRail.opened()}>
      <aside
        class="hidden h-full min-h-0 w-14 shrink-0 self-stretch flex-col items-center gap-2 pb-5 pt-2 md:flex"
        aria-label={language.t("home.projects")}
      >
        <Tooltip placement={tooltipPlacement()} value={language.t("home.project.add")}>
          <IconButton
            type="button"
            variant="ghost-muted"
            size="large"
            icon={<Icon name="plus" />}
            disabled={addDisabled()}
            onClick={chooseProject}
            aria-label={language.t("home.project.add")}
          />
        </Tooltip>
        <div class="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden px-2">
          <ProjectRailList
            projects={projects()}
            selected={(item) => {
              if (active()?.server !== ServerConnection.key(item.server)) return false
              const directory = active()?.directory
              if (!directory) return false
              const key = pathKey(directory)
              return (
                pathKey(item.project.worktree) === key ||
                !!item.project.sandboxes?.some((sandbox) => pathKey(sandbox) === key)
              )
            }}
            onMove={(item, index) => home.server.context(item.server).projects.move(item.project.worktree, index)}
            onSelect={(item) => {
              home.server.context(item.server).projects.touch(item.project.worktree)
              home.selection.set({
                server: ServerConnection.key(item.server),
                directory: item.project.worktree,
              })
              navigate("/")
            }}
          />
        </div>
        <div class="mt-auto flex shrink-0 flex-col items-center gap-1">
          <Tooltip placement={tooltipPlacement()} value={language.t("sidebar.settings")}>
            <IconButton
              type="button"
              variant="ghost-muted"
              size="large"
              icon={<Icon name="settings-gear" />}
              onClick={openSettings}
              aria-label={language.t("sidebar.settings")}
            />
          </Tooltip>
          <Tooltip placement={tooltipPlacement()} value={language.t("sidebar.help")}>
            <IconButton
              type="button"
              variant="ghost-muted"
              size="large"
              icon={<Icon name="help" />}
              onClick={() => platform.openExternal("https://opencode.ai/desktop-feedback")}
              aria-label={language.t("sidebar.help")}
            />
          </Tooltip>
          <Show when={platform.platform === "desktop"}>
            <Tooltip placement={tooltipPlacement()} value={language.t("sidebar.quit")}>
              <IconButton
                type="button"
                variant="ghost-muted"
                size="large"
                icon={<Icon name="power" />}
                onClick={() => void platform.quitApp?.()}
                aria-label={language.t("sidebar.quit")}
              />
            </Tooltip>
          </Show>
        </div>
      </aside>
    </Show>
  )
}

function ProjectRailList(props: {
  projects: RailProject[]
  selected: (project: RailProject) => boolean
  onMove: (project: RailProject, index: number) => void
  onSelect: (project: RailProject) => void
}) {
  let listRef!: HTMLDivElement
  return (
    <DragDropProvider
      sensors={(defaults) => [
        ...defaults.filter((sensor) => sensor !== PointerSensor),
        PointerSensor.configure({
          activationConstraints: (event) =>
            event.pointerType === "touch"
              ? [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
              : [new PointerActivationConstraints.Distance({ value: 4 })],
        }),
      ]}
      modifiers={[RestrictToVerticalAxis, RestrictToElement.configure({ element: () => listRef })]}
      plugins={(defaults) => [
        ...defaults.filter((plugin) => plugin !== AutoScroller && plugin !== Feedback),
        AutoScroller.configure({ acceleration: 8, threshold: { x: 0, y: 0.05 } }),
        Feedback.configure({ dropAnimation: null }),
      ]}
      onDragEnd={(event) => {
        const source = event.operation.source
        if (event.canceled || !isSortable(source)) return
        if (source.initialIndex === source.index) return
        const item = props.projects.find((project) => project.id === source.id.toString())
        if (!item) return
        const server = ServerConnection.key(item.server)
        const moved = arrayMove(props.projects, source.initialIndex, source.index)
        const index = moved.filter((project) => ServerConnection.key(project.server) === server).indexOf(item)
        if (index !== -1) props.onMove(item, index)
      }}
    >
      <div ref={listRef} class="flex flex-col items-center gap-2">
        <For each={props.projects.map((project) => project.id)}>
          {(id, index) => <ProjectRailSlot {...props} id={id} index={index()} />}
        </For>
      </div>
    </DragDropProvider>
  )
}

function ProjectRailSlot(props: Parameters<typeof ProjectRailList>[0] & { id: string; index: number }) {
  const initial = props.projects.find((project) => project.id === props.id)
  if (!initial) return
  const project = createMemo<RailProject>(
    (previous) => props.projects.find((item) => item.id === props.id) ?? previous,
    initial,
  )
  const sortable = useSortable({
    get id() {
      return props.id
    },
    get index() {
      return props.index
    },
  })
  const name = () => displayName(project().project)

  return (
    <div ref={sortable.ref} class="relative flex size-10" classList={{ "z-10": sortable.isDragSource() }}>
      <button
        type="button"
        class="flex size-10 items-center justify-center rounded-lg border border-transparent transition-colors hover:bg-v2-background-bg-layer-01 focus-visible:bg-v2-background-bg-layer-01 focus-visible:outline-none"
        classList={{
          "border-v2-border-border-strong bg-v2-background-bg-layer-03 shadow-[var(--v2-elevation-raised)]":
            props.selected(project()),
          "bg-v2-background-bg-layer-01": sortable.isDragSource(),
        }}
        onClick={(event) => {
          if (event.defaultPrevented) return
          props.onSelect(project())
        }}
        title={name()}
        aria-label={name()}
        aria-current={props.selected(project()) ? "page" : undefined}
      >
        <ProjectAvatar
          class="!size-8 [&_[data-slot=project-avatar-surface]]:!text-[15px]"
          fallback={name()}
          src={getProjectAvatarSource(project().project.id, project().project.icon)}
          variant={getProjectAvatarVariant(project().project.icon?.color)}
        />
      </button>
    </div>
  )
}
