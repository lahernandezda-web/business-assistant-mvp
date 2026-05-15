export type AIProviderName = "stub" | "claude";

export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AICompletionInput = {
  messages: AIMessage[];
};

export type AICompletionResult = {
  content: string;
};

export type AIProvider = {
  complete(input: AICompletionInput): Promise<AICompletionResult>;
};
