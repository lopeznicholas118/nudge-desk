import Anthropic from "@anthropic-ai/sdk";
import type { LlmClient, LlmResponse } from "./types";

export function createAnthropicLlm(opts: { apiKey: string; model: string }): LlmClient {
  const client = new Anthropic({ apiKey: opts.apiKey, timeout: 60_000, maxRetries: 2 });

  return {
    model: opts.model,
    async complete(req) {
      const res = await client.messages.create({
        model: opts.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: req.messages as Anthropic.MessageParam[],
        tools: req.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
        })),
      });

      // Normalize: keep only the block types and fields we use.
      const content: LlmResponse["content"] = [];
      for (const block of res.content) {
        if (block.type === "text") content.push({type: "text", text: block.text});
        else if (block.type === "tool_use")
          content.push({type: "tool_use", id: block.id, name: block.name, input: block.input});
      }

      return {
        content,
        stopReason: res.stop_reason,
        usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
      };
    },
  };
}