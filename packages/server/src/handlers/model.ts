import { Catalog } from "@opencode-ai/core/catalog"
import { ModelsDev } from "@opencode-ai/core/models-dev"
import { Plugin } from "@opencode-ai/core/plugin"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { response } from "../location"

export const ModelHandler = HttpApiBuilder.group(Api, "server.model", (handlers) =>
  handlers
    .handle(
      "model.list",
      Effect.fn(function* () {
        const catalog = yield* Catalog.Service
        return yield* response(catalog.model.available())
      }),
    )
    .handle(
      "model.default",
      Effect.fn(function* () {
        const catalog = yield* Catalog.Service
        return yield* response(catalog.model.default())
      }),
    )
    .handle(
      "model.refresh",
      Effect.fn(function* () {
        const plugins = yield* Plugin.Service
        yield* plugins.awaitActivation
        const modelsDev = yield* ModelsDev.Service
        yield* modelsDev.refresh(true)
        const catalog = yield* Catalog.Service
        return yield* response(catalog.model.available())
      }),
    ),
)
