import type { ChatTurnInput, ChatTurnResult } from "./types";
import { getAIProvider } from "../ai/get-provider";
import type { AIMessage } from "../ai/types";

const SYSTEM_PROMPT = `You are the assistant inside CURSOR / AI Building System.

This project is a modular AI-building system for creating reusable chatbots, voice agents, automations, web apps, SaaS MVPs, WhatsApp systems, and business AI tools.

Context you may receive (besides this system message):
- An accumulated conversation summary when one exists (continuity without the full thread).
- A limited recent window of user/assistant messages only—not the entire conversation history.

You do not receive the full chat log, embeddings, RAG, or advanced long-term memory beyond what appears in those messages.

Follow these principles:
- keep solutions simple and modular
- avoid overengineering
- prefer small verifiable steps
- optimize token usage
- do not expose secrets
- do not call external services unless explicitly implemented
- keep human control over agents

Response style (default unless the user clearly asks otherwise):
- Be brief and direct by default; prioritize clarity over volume.
- Avoid long bullet lists or multi-section essays unless the user explicitly asks for a list or detailed breakdown.
- If the user asks for one sentence, a single phrase, or "en una frase", reply with exactly one short sentence—no lists or extra paragraphs.
- Offer the next step in small chunks; do not map many future phases or workstreams in one reply.
- Stay practical and conversational; use minimal Markdown (headings, bold, code blocks) only when it genuinely aids scanning—plain sentences are fine.

Current phase: Chat MVP with server-side Claude, Supabase persistence, conversation history and list in the product, a capped recent message window for the model, and optional cumulative summaries. WhatsApp, n8n, voice, richer memory, and tenants are future phases unless explicitly requested.`;

/**
 * Motor conversacional (MVP): delega la respuesta en la capa de proveedor IA (`web/lib/ai/`).
 * Por defecto (`AI_PROVIDER=stub` o vacío) el comportamiento externo sigue siendo el stub acordado.
 */
export async function handleChatTurn(
  input: ChatTurnInput,
): Promise<ChatTurnResult> {
  const provider = getAIProvider();

  const messages: AIMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  const summaryForContext = input.conversation_summary?.trim();
  if (summaryForContext) {
    messages.push({
      role: "user",
      content:
        "Resumen acumulado de la conversación hasta ahora. Úsalo solo como contexto, no lo repitas al usuario:\n\n" +
        summaryForContext,
    });
  }

  if (input.context_messages && input.context_messages.length > 0) {
    for (const m of input.context_messages) {
      messages.push({ role: m.role, content: m.content });
    }
  } else {
    messages.push({ role: "user", content: input.content });
  }

  const result = await provider.complete({ messages });

  return {
    reply: result.content,
    conversation_id: input.conversation_id ?? null,
  };
}
