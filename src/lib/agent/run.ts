import { llm } from "@/lib/config";
import { executeTool, type ToolContext } from "@/lib/agent/execute";
import type { AgentEvent, LlmProvider } from "@/lib/agent/provider";
import { createAnthropicProvider } from "@/lib/agent/providers/anthropic";
import { createOpenAiProvider } from "@/lib/agent/providers/openai";
import { buildSystemPrompt } from "@/lib/agent/systemPrompt";
import type { ChatRequestBody, ChatResponseBody, ClientAction } from "@/lib/types";

/** Caps a runaway tool loop; three rounds covers every flow in the app. */
const MAX_TOOL_ROUNDS = 4;

export class LlmNotConfiguredError extends Error {}

function getProvider(): LlmProvider {
  if (llm.provider === "openai") {
    if (!llm.openaiApiKey) throw new LlmNotConfiguredError("OPENAI_API_KEY is not set");
    return createOpenAiProvider();
  }
  if (!llm.anthropicApiKey) throw new LlmNotConfiguredError("ANTHROPIC_API_KEY is not set");
  return createAnthropicProvider();
}

export async function runAgent(
  body: ChatRequestBody,
  options: { origin: string; lastPaymentSessionId: string | null },
): Promise<ChatResponseBody> {
  const provider = getProvider();
  const system = buildSystemPrompt(body.wallet);

  const events: AgentEvent[] = body.messages.map((message) =>
    message.role === "user"
      ? { type: "user", text: message.content }
      : { type: "assistant", text: message.content, toolCalls: [] },
  );

  const ctx: ToolContext = {
    wallet: body.wallet,
    pendingAction: body.pendingAction,
    origin: options.origin,
    lastPaymentSessionId: options.lastPaymentSessionId,
  };

  // Guards against the model preparing and confirming a payment in a single
  // turn, which would spend money without the user ever being asked.
  const preparedThisTurn = new Set<string>();

  let clientAction: ClientAction | null = null;
  const toolsUsed: string[] = [];
  let reply = "";

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const turn = await provider.complete({ system, events });
    reply = turn.text || reply;

    if (turn.toolCalls.length === 0) break;

    events.push({ type: "assistant", text: turn.text, toolCalls: turn.toolCalls });

    const results: { id: string; name: string; content: string }[] = [];

    for (const call of turn.toolCalls) {
      toolsUsed.push(call.name);

      if (call.name === "confirm_pending_action" && preparedThisTurn.size > 0) {
        results.push({
          id: call.id,
          name: call.name,
          content: JSON.stringify({
            error: "confirmation_required",
            message:
              "You just prepared this action. Read the amount back to the person and wait for them to agree on their own turn before confirming.",
          }),
        });
        continue;
      }

      const outcome = await executeTool(call.name, call.input, ctx);

      if (outcome.pendingAction !== undefined) {
        ctx.pendingAction = outcome.pendingAction;
        if (outcome.pendingAction) preparedThisTurn.add(call.name);
      }
      if (outcome.clientAction) clientAction = outcome.clientAction;

      results.push({ id: call.id, name: call.name, content: JSON.stringify(outcome.result) });
    }

    events.push({ type: "tool_results", results });
    reply = "";
  }

  return {
    reply: reply || "Sorry, I didn't catch that. Could you say it again?",
    pendingAction: ctx.pendingAction,
    clientAction,
    toolsUsed,
  };
}
