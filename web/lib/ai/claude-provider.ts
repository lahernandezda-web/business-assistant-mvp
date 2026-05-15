import Anthropic from "@anthropic-ai/sdk";
import type {
  AICompletionInput,
  AICompletionResult,
  AIMessage,
  AIProvider,
} from "./types";

const DEFAULT_MODEL = "claude-haiku-4-5";

const MISSING_KEY_MESSAGE =
  "Claude is configured but ANTHROPIC_API_KEY is missing. Use AI_PROVIDER=stub or add the key to web/.env.local.";

const NO_CONVERSATION_MESSAGES =
  "No user or assistant messages to send. Add at least one user message.";

const EMPTY_MODEL_REPLY =
  "The assistant did not return any text. Please try again.";

const GENERIC_FAILURE_MESSAGE =
  "The AI request could not be completed. Please try again later.";

type AnthropicTurnMessage = { role: "user" | "assistant"; content: string };

function buildAnthropicPayload(messages: AIMessage[]): {
  system?: string;
  conversation: AnthropicTurnMessage[];
} {
  const systemChunks: string[] = [];
  const conversation: AnthropicTurnMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemChunks.push(msg.content);
    } else {
      conversation.push({ role: msg.role, content: msg.content });
    }
  }

  const system =
    systemChunks.length > 0 ? systemChunks.join("\n\n") : undefined;

  return { system, conversation };
}

function textFromMessage(message: Anthropic.Message): string {
  const parts: string[] = [];
  for (const block of message.content) {
    if (block.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("");
}

export const claudeProvider: AIProvider = {
  async complete(input: AICompletionInput): Promise<AICompletionResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return { content: MISSING_KEY_MESSAGE };
    }

    const { system, conversation } = buildAnthropicPayload(input.messages);
    if (conversation.length === 0) {
      return { content: NO_CONVERSATION_MESSAGES };
    }

    const model =
      process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model,
        max_tokens: 512,
        temperature: 0.3,
        stream: false,
        ...(system !== undefined ? { system } : {}),
        messages: conversation,
      });

      const content = textFromMessage(response).trim();
      if (!content) {
        return { content: EMPTY_MODEL_REPLY };
      }

      return { content };
    } catch {
      return { content: GENERIC_FAILURE_MESSAGE };
    }
  },
};
