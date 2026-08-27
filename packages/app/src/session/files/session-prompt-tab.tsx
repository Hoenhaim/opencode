import { createResource, For, Show } from "solid-js"
import { useData } from "@/runtime/server/current"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
import { useServerSDK } from "@/runtime/server/client"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { Markdown } from "@opencode-ai/session-ui/markdown"
import { showToast } from "@/shell/notifications/toast"
import { useSessionLayout } from "@/session/session-layout"

// Highlights file references like absolute AGENTS.md paths by rendering them as inline code.
const highlightFileReferences = (text: string) => text.replace(/(^|[\s`(])(\/[^\s`*_"']+\.(?:md|txt))/g, "$1`$2`")

function SourceRow(props: { path: string; onOpen: (path: string) => void }) {
  const language = useLanguage()
  const name = () => props.path.split("/").at(-1) ?? props.path
  return (
    <div class="flex items-center justify-between gap-2 border border-border-base rounded-md bg-surface-base px-3 py-2">
      <div class="min-w-0 flex flex-col">
        <div class="text-12-medium text-text-strong truncate">{name()}</div>
        <div class="text-12-regular text-text-weak truncate">{props.path}</div>
      </div>
      <Button
        size="small"
        variant="ghost"
        class="gap-1.5 px-2 text-text-weak hover:text-text-base shrink-0"
        onClick={() => props.onOpen(props.path)}
      >
        <Icon name="open-file" size="small" />
        <span>{language.t("prompt.open")}</span>
      </Button>
    </div>
  )
}

export function SessionPromptTab() {
  const language = useLanguage()
  const data = useData()
  const serverSDK = useServerSDK()
  const platform = usePlatform()
  const { params } = useSessionLayout()

  const [prompt] = createResource(
    () => ({ id: params.id, revision: data.session.get(params.id ?? "")?.time.updated }),
    async (input) => {
      if (!input.id) return undefined
      return serverSDK.api.session.systemPrompt({ sessionID: input.id })
    },
  )

  const openSource = (path: string) => {
    if (!platform.openPath) return
    platform
      .openPath(path)
      .catch((err: unknown) =>
        showToast({
          variant: "error",
          title: language.t("common.requestFailed"),
          description: err instanceof Error ? err.message : String(err),
        }),
      )
  }

  return (
    <ScrollView class="h-full">
      <div class="px-6 pt-4 pb-10 flex flex-col gap-10">
        <Show when={prompt.loading}>
          <div class="text-12-regular text-text-weak">{language.t("common.loading")}</div>
        </Show>
        <Show when={prompt.error}>
          {(error) => (
            <div class="text-12-regular text-text-weak">
              {language.t("common.requestFailed")}: {error() instanceof Error ? error().message : String(error())}
            </div>
          )}
        </Show>
        <For each={prompt()?.system ?? []}>
          {(part, index) => (
            <div class="flex flex-col gap-2">
              <div class="text-12-regular text-text-weak">
                {language.t("prompt.system.title")}
                {(prompt()?.system.length ?? 0) > 1 ? ` ${index() + 1}` : ""}
              </div>
              <div class="border border-border-base rounded-md bg-surface-base px-3 py-2 select-text">
                <Markdown text={highlightFileReferences(part)} class="text-12-regular" />
              </div>
            </div>
          )}
        </For>
        <div class="flex flex-col gap-2">
          <div class="text-12-regular text-text-weak">{language.t("prompt.sources.title")}</div>
          <Show when={(prompt()?.sources.length ?? 0) === 0 && !prompt.loading}>
            <div class="text-12-regular text-text-weak">{language.t("prompt.sources.empty")}</div>
          </Show>
          <For each={prompt()?.sources ?? []}>{(source) => <SourceRow path={source.path} onOpen={openSource} />}</For>
        </div>
      </div>
    </ScrollView>
  )
}
