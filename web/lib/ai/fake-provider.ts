import type { AICompletionInput, AIProvider, AICompletionResult } from "./types";

/** Texto fijo del stub; debe coincidir con el contrato documentado del Chat MVP. */
export const FAKE_AI_STUB_CONTENT =
  "Respuesta stub del asistente. La integración con Claude se añadirá en una fase posterior.";

export const fakeAIProvider: AIProvider = {
  async complete(input: AICompletionInput): Promise<AICompletionResult> {
    void input;
    return { content: FAKE_AI_STUB_CONTENT };
  },
};
