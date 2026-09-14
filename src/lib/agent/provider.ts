export interface LlmToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** Provider-neutral transcript, converted to each vendor's shape per request. */
export type AgentEvent =
  | { type: "user"; text: string }
  | { type: "assistant"; text: string; toolCalls: LlmToolCall[] }
  | { type: "tool_results"; results: { id: string; name: string; content: string }[] };

export interface LlmTurn {
  text: string;
  toolCalls: LlmToolCall[];
}

export interface LlmProvider {
  readonly name: string;
  complete(params: { system: string; events: AgentEvent[] }): Promise<LlmTurn>;
}
