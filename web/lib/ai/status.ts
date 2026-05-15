const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5";

export type AIServerStatusPayload = {
  provider: "claude" | "stub";
  model: string | null;
  has_api_key: boolean;
};

/**
 * Estado de configuración del proveedor IA (solo `process.env`).
 * No expone la clave ni fragmentos; no lee archivos `.env`.
 */
export function getAIServerStatus(): AIServerStatusPayload {
  const rawProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
  const provider = rawProvider === "claude" ? "claude" : "stub";
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());

  const model =
    provider === "claude"
      ? process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_CLAUDE_MODEL
      : null;

  return {
    provider,
    model,
    has_api_key: provider === "claude" ? hasApiKey : false,
  };
}
