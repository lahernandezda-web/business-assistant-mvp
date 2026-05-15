import type { AICompletionInput, AIProvider, AICompletionResult } from "./types";

/** Texto fijo del stub; debe coincidir con el contrato documentado del Chat MVP. */
export const FAKE_AI_STUB_CONTENT =
  "Respuesta stub del asistente. La integración con Claude se añadirá en una fase posterior.";

const BUSINESS_CONTEXT_MARKER = "Business context:";

function stubReceivedBusinessContext(messages: AICompletionInput["messages"]): boolean {
  return messages.some(
    (m) => m.role === "user" && m.content.includes(BUSINESS_CONTEXT_MARKER),
  );
}

export const fakeAIProvider: AIProvider = {
  async complete(input: AICompletionInput): Promise<AICompletionResult> {
    const suffix = stubReceivedBusinessContext(input.messages)
      ? " [stub: business context received]"
      : "";
    return { content: FAKE_AI_STUB_CONTENT + suffix };
  },
};
