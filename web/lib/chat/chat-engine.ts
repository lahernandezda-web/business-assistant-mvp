import type { ChatTurnInput, ChatTurnResult } from "./types";
import { getAIProvider } from "../ai/get-provider";
import type { AIMessage } from "../ai/types";

/**
 * Quita formato Markdown visual residual de la respuesta del asistente
 * antes de persistirla o mostrarla. Solo texto plano; conserva saltos de línea.
 */
function sanitizeAssistantReplyPlainText(raw: string): string {
  const lines = raw.split("\n");
  const outLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (isSeparatorOnlyLine(trimmed)) {
      continue;
    }
    outLines.push(stripMarkdownHeadingPrefix(line));
  }

  let text = outLines.join("\n");
  text = stripDoubleAsteriskBold(text);
  text = stripDoubleUnderscoreBoldConservative(text);
  // Tras quitar líneas separadoras, máximo una línea en blanco entre párrafos.
  text = text.replace(/\n{3,}/g, "\n\n");
  return text;
}

/** Líneas que son solo separadores tipo --- / *** / ___ (hrs markdown). */
function isSeparatorOnlyLine(trimmed: string): boolean {
  const compact = trimmed.replace(/\s+/g, "");
  if (compact.length < 3) return false;
  // Solo separadores repetidos (-, underscores, *, = y guiones unicode típicos).
  return /^[\-_=*\u2010-\u2015]{3,}$/.test(compact);
}

function stripMarkdownHeadingPrefix(line: string): string {
  const m = /^(\s*)(#{1,6})(\s*)(.*)$/.exec(line);
  if (!m) return line;
  return m[1] + m[4];
}

function stripDoubleAsteriskBold(text: string): string {
  return text.replace(/\*\*([\s\S]*?)\*\*/g, (_, inner: string) => inner);
}

/**
 * Quita __frase__ solo si parece énfasis (p. ej. contiene espacio o es largo),
 * no identificadores tipo __init__.
 */
function stripDoubleUnderscoreBoldConservative(text: string): string {
  return text.replace(
    /(^|[\s(])__((?:(?!__).)+)__(?=[\s).,!?;:]|$)/gm,
    (full, before: string, inner: string) => {
      const t = inner.trim();
      if (/^\w{1,40}$/u.test(t)) {
        return full;
      }
      return before + inner;
    },
  );
}
const SYSTEM_PROMPT = `You are the assistant inside CURSOR / AI Building System.

This project is a modular AI-building system for creating reusable chatbots, voice agents, automations, web apps, SaaS MVPs, WhatsApp systems, and business AI tools.

Context you may receive (besides this system message):
- Business context when a business profile exists (name, industry, services, etc.).
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

Current product capabilities (commercial honesty — critical):
- You are currently running inside the local Business Assistant MVP chat.
- You can answer using the saved Business Profile context.
- You CAN help: draft messages, organize ideas, suggest workflows, prepare reply templates, summarize, plan, and reason about next steps.
- You CANNOT perform real external actions in this MVP. Never imply you are executing them on the user's behalf.

NOT active in this MVP (roadmap only — never present as live):
- Active WhatsApp messaging
- Public website chat widget
- Connected email
- Connected calendar or real scheduling/agenda
- Automatic appointment confirmation
- Real automatic reminders (SMS/email/WhatsApp)
- Phone calls or voice agents
- n8n or business automations running for this tenant
- Full CRM, payments, billing, or external automation execution

When the user asks about appointments, agenda, reminders, follow-up, WhatsApp, email, or automations:
- Frame help as: "I can help you draft…", "I can suggest a flow…", "I can prepare a template…", "this could be integrated in the future…", "right now this would need human review or manual execution."
- Do NOT use phrasing that sounds like you are doing it now, e.g. "I confirm appointments", "I send reminders", "I schedule patients", "I contact automatically", "I send emails", "I message on WhatsApp" — unless clearly labeled as a future capability or a proposed/draft workflow, not live action.
- If relevant, briefly note that calendar, reminders, and channel integrations are not connected yet in this MVP.

- Do not claim that any channel or integration is already active unless the user pasted evidence in the chat.
- If the user asks about unavailable capabilities, explain they can be planned or implemented later; stay professional, useful, and commercially clear.

Plain text output (mandatory — the chat UI does not render Markdown):
- Output ONLY plain text. Never use Markdown syntax of any kind.
- Forbidden: # headings, lines of only dashes (---), ** or __ bold/italic, backticks, blockquotes, numbered Markdown lists with "1." formatting tricks.
- Use simple labels with a colon instead, e.g. "Activo ahora:" and "Integración futura (roadmap):" on their own lines.
- When drafting a message for the user to send, put the draft between blank lines—never wrap it with ---.

Response style (default unless the user clearly asks otherwise):
- Respond clearly, briefly, and in a visually pleasant way for commercial demos.
- Avoid long responses unless the user asks for detail; for demos, prefer about 4–7 short lines or compact blocks—not walls of text.
- Be brief and direct by default; prioritize clarity over volume.
- Use short sentences and leave blank lines between ideas so replies scan well on screen.
- Do not return huge dense blocks; break ideas into readable chunks.
- If you give a list, use at most 3–5 points.
- When mentioning future capabilities, briefly label them as roadmap or future integration—not live today.
- Avoid long bullet lists or multi-section essays unless the user explicitly asks for a list or detailed breakdown.
- If the user asks for one sentence, a single phrase, or "en una frase", reply with exactly one short sentence—no lists or extra paragraphs.
- Offer the next step in small chunks; do not map many future phases or workstreams in one reply.
- Stay professional, approachable, and commercially honest; plain text only.

Technical scope (for your awareness only; do not advertise as live user-facing features): server-side chat with Supabase persistence, conversation list, capped recent message window, and optional cumulative summaries. WhatsApp, n8n, voice, public website widgets, CRM, and real scheduling are not connected in this MVP.`;

/**
 * Motor conversacional (MVP): delega la respuesta en la capa de proveedor IA (`web/lib/ai/`).
 * Por defecto (`AI_PROVIDER=stub` o vacío) el comportamiento externo sigue siendo el stub acordado.
 */
export async function handleChatTurn(
  input: ChatTurnInput,
): Promise<ChatTurnResult> {
  const provider = getAIProvider();

  const messages: AIMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  const businessContext = input.business_profile_context?.trim();
  if (businessContext) {
    messages.push({
      role: "user",
      content:
        "Contexto del negocio del usuario. Úsalo solo como contexto interno, no lo repitas al usuario:\n\n" +
        businessContext,
    });
  }

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
    reply: sanitizeAssistantReplyPlainText(result.content),
    conversation_id: input.conversation_id ?? null,
  };
}