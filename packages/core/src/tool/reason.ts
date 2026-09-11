export * as ToolReason from "./reason.js"

import type { ToolDefinition } from "@opencode-ai/ai"
import { isRecord } from "@opencode-ai/ai/utils/record"
import type { Config } from "@opencode-ai/schema/config"
import { Tool } from "@opencode-ai/schema/tool"
import { Wildcard } from "../util/wildcard.js"

/** Stays a Tool.Error until the Session runner settles the call and stops the attempt. */
export class StopError extends Tool.Error {}

export function advertise(tool: ToolDefinition, config: Config.Info["tool_reason"], name = tool.name) {
  const required =
    config?.rules?.findLast((rule) => Wildcard.match(tool.name, rule.tool))?.required ??
    (!["question", "ask"].includes(name) && (config?.required ?? true))
  if (!required) return { definition: tool }

  // Never consume an implementation-owned reason/description, including in referenced schemas.
  const schema = JSON.stringify(tool.inputSchema)
  let field = "_opencode_reason"
  while (schema.includes(JSON.stringify(field))) field = `_${field}`
  return {
    field,
    definition: {
      ...tool,
      description: `${tool.description}\n\nInclude ${field}: a short, nonempty English reason explaining why this call helps the user's request. This host-only field is not sent to the tool.`,
      inputSchema: {
        ...tool.inputSchema,
        properties: {
          ...(isRecord(tool.inputSchema.properties) ? tool.inputSchema.properties : {}),
          [field]: {
            type: "string",
            minLength: 1,
            pattern: "\\S",
            description:
              "Briefly explain why this tool call is needed for the user's request. Write the reason in English.",
          },
        },
        required: [...(Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : []), field],
      },
    } satisfies ToolDefinition,
  }
}
