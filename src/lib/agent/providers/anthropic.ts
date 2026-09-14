import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, Tool } from "@anthropic-ai/sdk/resources/messages";

import { llm } from "@/lib/config";
import type { AgentEvent, LlmProvider, LlmTurn } from "@/lib/agent/provider";
import { toolDefinitions } from "@/lib/agent/tools";

const tools: Tool[] = toolDefinitions.map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.inputSchema as Tool["input_schema"],
}));

function toMessages(events: AgentEvent[]): MessageParam[] {
  return events.map((event): MessageParam => {
    if (event.type === "user") {
      return { role: "user", content: event.text };
    }

    if (event.type === "assistant") {
      const content: MessageParam["content"] = [];
      if (event.text.trim()) content.push({ type: "text", text: event.text });
      for (const call of event.toolCalls) {
        content.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
      }
      return { role: "assistant", content };
    }

    return {
      role: "user",
      content: event.results.map((result) => ({
        type: "tool_result" as const,
        tool_use_id: result.id,
        content: result.content,
      })),
    };
  });
}

export function createAnthropicProvider(): LlmProvider {
  const client = new Anthropic({ apiKey: llm.anthropicApiKey });

  return {
    name: "anthropic",
    async complete({ system, events }): Promise<LlmTurn> {
      const response = await client.messages.create({
        model: llm.anthropicModel,
        max_tokens: 1024,
        system,
        tools,
        messages: toMessages(events),
        // Voice replies are short and latency-sensitive; deliberation adds
        // seconds of dead air while the user waits with the screen off.
        thinking: { type: "disabled" },
      });

      let text = "";
      const toolCalls: LlmTurn["toolCalls"] = [];

      for (const block of response.content) {
        if (block.type === "text") text += block.text;
        if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            input: (block.input ?? {}) as Record<string, unknown>,
          });
        }
      }

      return { text: text.trim(), toolCalls };
    },
  };
}
