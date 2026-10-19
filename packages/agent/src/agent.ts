import { buildSystemPrompt } from "./prompt";
import type { AgentStore } from "./store";
import { TOOLS, ToolError, type Tool, type ToolContext } from "./tools";
import type {
  LlmClient,
  LlmResponse,
  Message,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
} from "./types";

export const DEFAULT_MAX_STEPS = 12; // LLM calls per run
export const DEFAULT_MAX_DRAFTS = 3;
export const DEFAULT_MAX_TOKENS = 1500;
export const DEFAULT_REQUEST =
  "Review my network and draft messages for the people I'm most overdue to contact.";
const MAX_TOOL_OUTPUT_CHARS = 8000;

export type RunStatus = "completed" | "max_steps" | "max_tokens" | "error";

export type TraceStep =
  | {
      type: "llm";
      index: number;
      stopReason: string | null;
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
      text: string;
    }
  | {
      type: "tool";
      index: number;
      name: string;
      toolUseId: string;
      input: unknown;
      /** Exactly what the model saw. */
      output: string;
      isError: boolean;
      /** Real error detail for unexpected failures. Never sent to the model. */
      internalError?: string;
      latencyMs: number;
    };

export type AgentInput = {
  llm: LlmClient;
  store: AgentStore;
  now: Date;
  runId?: string | null;
  request?: string;
  voiceSamples?: readonly string[];
  tools?: readonly Tool[];
  maxSteps?: number;
  maxDrafts?: number;
  maxTokens?: number;
};

export type AgentResult = {
  status: RunStatus;
  finalText: string;
  draftIds: string[];
  steps: TraceStep[];
  usage: { inputTokens: number; outputTokens: number };
  error: string | null;
};

// Small private copy of the web app's helper; we'll consolidate later.
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const { code, message } = err as { code?: unknown; message?: unknown };
    return [code, message].filter(Boolean).map(String).join(" ");
  }
  return "unknown error";
}

const isText = (b: LlmResponse["content"][number]): b is TextBlock => b.type === "text";
const isToolUse = (b: LlmResponse["content"][number]): b is ToolUseBlock => b.type === "tool_use";

async function executeTool(
  use: ToolUseBlock,
  tools: ReadonlyMap<string, Tool>,
  ctx: ToolContext,
  steps: TraceStep[],
): Promise<ToolResultBlock> {
  const started = performance.now();
  let output = "";
  let isError = false;
  let internalError: string | undefined;

  const tool = tools.get(use.name);
  if (!tool) {
    isError = true;
    output = `Unknown tool '${use.name}'. Available tools: ${[...tools.keys()].join(", ")}.`;
  } else {
    try {
      output = JSON.stringify(await tool.execute(use.input, ctx)) ?? "null";
    } catch (err) {
      isError = true;
      if (err instanceof ToolError) {
        output = err.message;
      } else {
        internalError = describeError(err);
        console.error(`tool ${use.name} failed:`, internalError);
        output = "The tool failed unexpectedly. Continue without it.";
      }
    }
  }

  if (output.length > MAX_TOOL_OUTPUT_CHARS) output = output.slice(0, MAX_TOOL_OUTPUT_CHARS) + "…[truncated]";

  steps.push({
    type: "tool",
    index: steps.length,
    name: use.name,
    toolUseId: use.id,
    input: use.input,
    output,
    isError,
    internalError,
    latencyMs: performance.now() - started,
  });

  return { type: "tool_result", tool_use_id: use.id, content: output, ...(isError ? { is_error: true } : {}) };
}

/** Runs the tool-calling loop. Never throws: failures come back as status "error". */
export async function runAgent(input: AgentInput): Promise<AgentResult> {
  const tools = input.tools ?? TOOLS;
  const toolsByName = new Map(tools.map((t) => [t.name, t]));
  const maxSteps = input.maxSteps ?? DEFAULT_MAX_STEPS;
  const maxDrafts = input.maxDrafts ?? DEFAULT_MAX_DRAFTS;
  const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;

  const ctx: ToolContext = {
    store: input.store,
    now: input.now,
    runId: input.runId ?? null,
    maxDrafts,
    draftIds: [],
  };
  const system = buildSystemPrompt({ maxDrafts, voiceSamples: input.voiceSamples });
  const specs = tools.map((t) => t.spec);
  const messages: Message[] = [{ role: "user", content: input.request ?? DEFAULT_REQUEST }];
  const steps: TraceStep[] = [];
  const usage = { inputTokens: 0, outputTokens: 0 };
  let finalText = "";

  const finish = (status: RunStatus, error: string | null = null): AgentResult => ({
    status,
    finalText,
    draftIds: ctx.draftIds,
    steps,
    usage,
    error,
  });

  for (let call = 0; call < maxSteps; call++) {
    const started = performance.now();
    let response: LlmResponse;
    try {
      response = await input.llm.complete({ system, messages, tools: specs, maxTokens });
    } catch (err) {
      return finish("error", describeError(err));
    }

    usage.inputTokens += response.usage.inputTokens;
    usage.outputTokens += response.usage.outputTokens;
    finalText = response.content.filter(isText).map((b) => b.text).join("\n").trim();
    steps.push({
      type: "llm",
      index: steps.length,
      stopReason: response.stopReason,
      inputTokens: response.usage.inputTokens,
      outputTokens: response.usage.outputTokens,
      latencyMs: performance.now() - started,
      text: finalText,
    });
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter(isToolUse);
    if (response.stopReason !== "tool_use" || toolUses.length === 0) {
      return finish(response.stopReason === "max_tokens" ? "max_tokens" : "completed");
    }

    // Every tool_use needs a matching tool_result in the next user message.
    // Run them in order: save_draft calls must not race each other.
    const results: ToolResultBlock[] = [];
    for (const use of toolUses) results.push(await executeTool(use, toolsByName, ctx, steps));
    messages.push({ role: "user", content: results });
  }

  return finish("max_steps");
}