import { Show, createMemo, type ComponentProps } from "solid-js"
import { Icon } from "@opencode-ai/ui/icon"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { createMediaQuery } from "@solid-primitives/media"

import { useFile } from "@/workspaces/files/model"
import { useLayout } from "@/shell/state/layout"
import { useLanguage } from "@/runtime/i18n/language"
import { useSessionLayout } from "@/session/session-layout"
import { createSessionTabs, openSessionPanelTab } from "@/session/helpers"

export function SessionPromptButton(props: { placement?: ComponentProps<typeof Tooltip>["placement"] }) {
  const file = useFile()
  const layout = useLayout()
  const language = useLanguage()
  const { params, tabs, view } = useSessionLayout()
  const isDesktop = createMediaQuery("(min-width: 768px)")
  const tabState = createSessionTabs({
    tabs,
    pathFromTab: file.pathFromTab,
    normalizeTab: (tab) => (tab.startsWith("file://") ? file.tab(tab) : tab),
    fileBrowser: () => isDesktop() && !!params.id,
  })
  const promptVisible = createMemo(() => view().reviewPanel.opened() && tabState.activeTab() === "prompt")

  const openPrompt = () => {
    if (!params.id) return

    const sessionView = view()
    if (promptVisible()) {
      tabs().close("prompt")
      return
    }

    openSessionPanelTab({
      openReviewPanel: () => sessionView.reviewPanel.open(),
      showAllFiles: () => {
        if (layout.fileTree.opened() && layout.fileTree.tab() !== "all") layout.fileTree.setTab("all")
      },
      openTab: (tab) => tabs().open(tab),
      setActive: tabs().setActive,
      tab: "prompt",
    })
  }

  return (
    <Show when={params.id}>
      <Tooltip value={language.t("command.view.prompt")} placement={props.placement ?? "top"} shift={-8}>
        <IconButton
          type="button"
          variant="ghost-muted"
          size="large"
          icon={<Icon name="prompt" />}
          state={promptVisible() ? "pressed" : undefined}
          onClick={openPrompt}
          aria-label={language.t("command.view.prompt")}
          aria-pressed={promptVisible()}
        />
      </Tooltip>
    </Show>
  )
}
