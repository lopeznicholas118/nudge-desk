// Our own minimal message types, decoupled from any SDK. Only anthropic.ts knows the real one.

export type TextBlock = {
    type: "text";
    text: string
};

export type ToolUseBlock = {
    type: "tool_use"; 
    id: string; name: string; 
    input: unknown
};

export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

export type Message =
  | {role: "user"; content: string | ToolResultBlock[]}
  | {role: "assistant"; content: Array<TextBlock | ToolUseBlock>};

export type ToolSpec = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type LlmRequest = {
  system: string;
  messages: Message[];
  tools: ToolSpec[];
  maxTokens: number;
};

export type LlmResponse = {
  content: Array<TextBlock | ToolUseBlock>;
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
};

export interface LlmClient {
  readonly model: string;
  complete(request: LlmRequest): Promise<LlmResponse>;
}