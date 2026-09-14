import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

import { llm } from "@/lib/config";
import type { AgentEvent, LlmProvider, LlmTurn } from "@/lib/agent/provider";
import { toolDefinitions } from "@/lib/agent/tools";

const tools: ChatCompletionTool[] = toolDefinitions.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema as Record<string, unknown>,
  },
}));

function toMessages(system: string, events: AgentEvent[]): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [{ role: "system", content: system }];

  for (const event of events) {
    if (event.type === "user") {
      messages.push({ role: "user", content: event.text });
      continue;
    }

    if (event.type === "assistant") {
      messages.push({
        role: "assistant",
        content: event.text || null,
        ...(event.toolCalls.length > 0 && {
          tool_calls: event.toolCalls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: { name: call.name, arguments: JSON.stringify(call.input) },
          })),
        }),
      });
      continue;
    }

    for (const result of event.results) {
      messages.push({ role: "tool", tool_call_id: result.id, content: result.content });
    }
  }

  return messages;
}

export function createOpenAiProvider(): LlmProvider {
  const client = new OpenAI({
    apiKey: llm.openaiApiKey,
    ...(llm.openaiBaseUrl && { baseURL: llm.openaiBaseUrl }),
  });

  return {
    name: "openai",
    async complete({ system, events }): Promise<LlmTurn> {
      const response = await client.chat.completions.create({
        model: llm.openaiModel,
        max_tokens: 1024,
        tools,
        messages: toMessages(system, events),
      });

      const message = response.choices[0]?.message;
      const toolCalls: LlmTurn["toolCalls"] = [];

      for (const call of message?.tool_calls ?? []) {
        if (call.type !== "function") continue;
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          input = {};
        }
        toolCalls.push({ id: call.id, name: call.function.name, input });
      }

      return { text: (message?.content ?? "").trim(), toolCalls };
    },
  };
}
