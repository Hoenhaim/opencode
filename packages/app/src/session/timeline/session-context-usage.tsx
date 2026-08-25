import { Show, createMemo, type ComponentProps, type JSX } from "solid-js"
import { ProgressCircle } from "@opencode-ai/ui/progress-circle"
import { IconButton } from "@opencode-ai/ui/icon-button"
import { Button } from "@opencode-ai/ui/button"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { createMediaQuery } from "@solid-primitives/media"

import { useFile } from "@/workspaces/files/model"
import { useLayout } from "@/shell/state/layout"
import { useData } from "@/runtime/server/current"
import { useLanguage } from "@/runtime/i18n/language"
import { useProviders } from "@/providers/catalog/providers"
import { useWorkspaceLocation } from "@/workspaces/location"
import { useSessionLayout } from "@/session/session-layout"
import { createSessionTabs } from "@/session/helpers"
import { useSettings } from "@/settings/model"

interface SessionContextUsageProps {
  variant?: "button" | "indicator"
  placement?: ComponentProps<typeof Tooltip>["placement"]
}

function ContextTooltipRow(props: { name: JSX.Element; value: JSX.Element }) {
  return (
    <div class="flex min-w-0 items-center gap-4">
      <span class="shrink-0 text-v2-text-text-muted">{props.name}</span>
      <span class="ml-auto min-w-0 truncate text-right text-v2-text-text-base">{props.value}</span>
    </div>
  )
}

function openSessionContext(args: {
  view: ReturnType<ReturnType<typeof useLayout>["view"]>
  layout: ReturnType<typeof useLayout>
  tabs: ReturnType<ReturnType<typeof useLayout>["tabs"]>
}) {
  args.view.reviewPanel.open(args.view.reviewPanel.opened() ? "other" : "context-button")
  if (args.layout.fileTree.opened() && args.layout.fileTree.tab() !== "all") args.layout.fileTree.setTab("all")
  void args.tabs.open("context").then(() => args.tabs.setActive("context"))
}

export function SessionContextUsage(props: SessionContextUsageProps) {
  const data = useData()
  const file = useFile()
  const layout = useLayout()
  const language = useLanguage()
  const settings = useSettings()
  const sdk = useWorkspaceLocation()
  const providers = useProviders(() => sdk().directory)
  const { params, tabs, view } = useSessionLayout()
  const isDesktop = createMediaQuery("(min-width: 768px)")

  const variant = createMemo(() => props.variant ?? "button")
  const tabState = createSessionTabs({
    tabs,
    pathFromTab: file.pathFromTab,
    normalizeTab: (tab) => (tab.startsWith("file://") ? file.tab(tab) : tab),
    fileBrowser: () => isDesktop() && !!params.id,
  })
  const messages = createMemo(() => (params.id ? data.session.message.list(params.id) : []))
  const info = createMemo(() => (params.id ? data.session.get(params.id) : undefined))

  const usd = createMemo(
    () =>
      new Intl.NumberFormat(language.intl(), {
        style: "currency",
        currency: "USD",
      }),
  )

  const context = createMemo(() => {
    const message = messages().findLast((item) => item.type === "assistant" && !!item.tokens)
    if (message?.type !== "assistant" || !message.tokens) return
    const model = providers.all().get(message.model.providerID)?.models[message.model.id]
    const total =
      message.tokens.input +
      message.tokens.output +
      message.tokens.reasoning +
      message.tokens.cache.read +
      message.tokens.cache.write
    return {
      total,
      usage: model?.limit.context ? Math.round((total / model.limit.context) * 100) : null,
    }
  })
  const tokens = createMemo(() =>
    new Intl.NumberFormat(language.intl(), {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1,
    }).format(context()?.total ?? 0),
  )
  const cost = createMemo(() => {
    return usd().format(info()?.cost ?? 0)
  })
  const contextVisible = createMemo(() => view().reviewPanel.opened() && tabState.activeTab() === "context")
  const hasOtherTabs = createMemo(() =>
    tabs()
      .all()
      .some((tab) => tab !== "context" && tab !== "review"),
  )

  const openContext = () => {
    if (!params.id) return

    const sessionView = view()
    if (contextVisible()) {
      tabs().close("context")
      if (sessionView.reviewPanel.source() === "context-button" && !hasOtherTabs()) sessionView.reviewPanel.close()
      return
    }

    openSessionContext({
      view: sessionView,
      layout,
      tabs: tabs(),
    })
  }

  const toggleDisplay = (event: MouseEvent) => {
    event.preventDefault()
    settings.general.setContextUsageMode(settings.general.contextUsageMode() === "circle" ? "text" : "circle")
  }

  const circle = () => (
    <div class="flex items-center justify-center">
      <ProgressCircle
        appearance="indicator"
        size={16}
        strokeWidth={2}
        percentage={context()?.usage ?? 0}
        style={{
          "--progress-circle-background": "var(--v2-background-bg-layer-04, var(--border-weak-base))",
          "--progress-circle-background-overlay": "var(--v2-overlay-simple-overlay-pressed, transparent)",
          "--progress-circle-progress": "var(--v2-icon-icon-base, var(--icon-base))",
        }}
      />
    </div>
  )
  const compactCircle = () => (
    <div class="flex items-center justify-center">
      <ProgressCircle appearance="compact" percentage={context()?.usage ?? 0} />
    </div>
  )

  const text = () => (
    <span class="inline-flex w-fit min-w-max whitespace-nowrap justify-center text-12-medium tabular-nums text-v2-icon-icon-base">
      {context()?.usage ?? 0}% / {cost()} / {tokens()}
    </span>
  )

  const tooltipValue = () => (
    <div class="flex w-[120px] flex-col gap-2">
      <ContextTooltipRow name={language.t("context.usage.cost")} value={cost()} />
      <ContextTooltipRow name={language.t("context.usage.usage")} value={`${context()?.usage ?? 0}%`} />
      <ContextTooltipRow
        name={language.t("context.usage.tokens")}
        value={context()?.total.toLocaleString(language.intl()) ?? "0"}
      />
    </div>
  )

  return (
    <Show when={params.id}>
      <Tooltip value={tooltipValue()} placement={props.placement ?? "top"} shift={-8}>
        <Show
          when={variant() === "indicator"}
          fallback={
            <Show
              when={settings.general.contextUsageMode() === "text"}
              fallback={
                <IconButton
                  type="button"
                  variant="ghost-muted"
                  size="large"
                  icon={compactCircle()}
                  onClick={openContext}
                  onContextMenu={toggleDisplay}
                  aria-label={language.t("context.usage.view")}
                />
              }
            >
              <Button
                type="button"
                variant="ghost"
                class="h-7 w-fit min-w-max px-2"
                onClick={openContext}
                onContextMenu={toggleDisplay}
                aria-label={language.t("context.usage.view")}
              >
                {text()}
              </Button>
            </Show>
          }
        >
          {circle()}
        </Show>
      </Tooltip>
    </Show>
  )
}
