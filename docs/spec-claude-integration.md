# Claude Integration Specification

## 1. Objective

The goal of a future implementation block is to integrate **Claude** as the primary server-side AI provider for the CURSOR / AI Building System, while preserving the existing **modular architecture** (validation → chat engine → AI provider layer). API keys must **never** be exposed to the browser: Anthropic is called **only** from server code (e.g. API routes and server modules), with configuration loaded from environment variables on the host.

This document describes the Claude integration; **server-side Claude is implemented** in `web/lib/ai/claude-provider.ts` (see §2 for activation and defaults).

## 2. Current Status

The web app (Next.js App Router under `web/`) already exposes `POST /api/chat/turn` and routes conversation logic through a clear stack:

| Area | Path | Role |
|------|------|------|
| AI types | `web/lib/ai/types.ts` | Defines `AIProvider`, `AICompletionInput`, `AICompletionResult`, `AIMessage`, `AIProviderName`. |
| Safe default provider | `web/lib/ai/fake-provider.ts` | Deterministic / safe behavior when using stub mode. |
| Claude provider | `web/lib/ai/claude-provider.ts` | **Real** Anthropic Messages API via the official SDK when `AI_PROVIDER=claude` and `ANTHROPIC_API_KEY` is set; controlled copy-only responses if the key is missing. |
| Provider resolution | `web/lib/ai/get-provider.ts` | Selects provider from `AI_PROVIDER` (empty, unknown, or `stub` → fake; `claude` → Claude provider). |
| Conversation engine | `web/lib/chat/chat-engine.ts` | Orchestrates turns and invokes the resolved provider’s `complete()`; sends a **short fixed system prompt** plus the user message each turn (keep it brief for token cost). |
| HTTP entry | `web/app/api/chat/turn/route.ts` | Validates input and delegates to the chat engine. |
| AI status (diagnostic) | `web/app/api/ai/status/route.ts` | **`GET /api/ai/status`** — safe server-only check: `provider`, `model`, `has_api_key` (from `web/lib/ai/status.ts`). Never returns the API key or key fragments. |

**Diagnostic:** use **`GET /api/ai/status`** to confirm stub vs Claude configuration without exposing secrets. Keep responses minimal for token/security hygiene; the route only reads `process.env`.

Input validation lives in `web/lib/chat/validate-input.ts` (separate from the engine).

**Defaults:** keep **`AI_PROVIDER=stub`** (or empty / unknown) in shared configs so **accidental spend** does not occur. **Real Claude** runs only when **`AI_PROVIDER=claude`** and a valid **`ANTHROPIC_API_KEY`** is present in **`web/.env.local`** (or host secrets). **`ANTHROPIC_MODEL`** defaults to **`claude-haiku-4-5`** if unset (see §6).

## 3. Security Rules

- **`ANTHROPIC_API_KEY`** must exist only in **`web/.env.local`** (or the deployment platform’s secret store), never committed.
- **Never** embed real keys in source code, comments, or examples.
- **Never** put real keys in **`web/.env.example`**; keep placeholders only (e.g. empty value or descriptive text without secrets).
- **Never** invoke Claude from React client components, `"use client"` bundles, or any code shipped to the browser.
- **Claude (Anthropic) calls must run only on the server** (Route Handlers, Server Actions, or other server-only modules).
- **`.env.local`** must remain **out of Git** (via `.gitignore`); treat any leak as a credential rotation event.
- If **`AI_PROVIDER=claude`** but **`ANTHROPIC_API_KEY`** is missing or invalid, the API must return a **controlled error** or a **safe fallback** (product decision), without leaking key material or raw upstream stack traces to the client.

## 4. Environment Variables

**Local / safe development (default):**

```env
AI_PROVIDER=stub
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-haiku-4-5
```

**Claude enabled (keys only on server / `web/.env.local`):**

```env
AI_PROVIDER=claude
ANTHROPIC_API_KEY=<real_key_only_in_env_local_or_host_secrets>
ANTHROPIC_MODEL=claude-haiku-4-5
```

**Important:** `web/.env.example` documents variable **names** and safe placeholder values only—**never** real `ANTHROPIC_API_KEY` values.

## 5. Provider Contract

The real Claude provider must implement the **`AIProvider`** contract in `web/lib/ai/types.ts`:

```ts
complete(input: AICompletionInput): Promise<AICompletionResult>
```

Where:

- **`AICompletionInput`** includes **`messages: AIMessage[]`** (`role`: `system` | `user` | `assistant`, `content`: string).
- **`AICompletionResult`** is **`{ content: string }`**.

The implementation should:

- Pass **`messages`** through to Anthropic in a shape compatible with the chosen API (SDK or `fetch`).
- Use a **model** chosen per section 6 (internal default or `ANTHROPIC_MODEL`).
- Use a **reasonable `max_tokens`** ceiling aligned with product limits.
- Use **low or moderate temperature** for stable assistant behavior unless product requirements change.

**Explicitly out of scope for the first real integration (per this spec):**

- Streaming responses.
- Tools / tool use.
- Function calling.

Return shape remains **`{ content: string }`** only.

## 6. Model Choice

Optional variable (documented in `web/.env.example`):

```env
ANTHROPIC_MODEL=claude-haiku-4-5
```

- If **`ANTHROPIC_MODEL`** is set, `claude-provider` uses that model id when calling Anthropic.
- If unset, the code default is **`claude-haiku-4-5`** (same value as in the example file).

## 7. Error Handling

Expected behavior when real Claude is implemented:

- **Missing `ANTHROPIC_API_KEY`** with **`AI_PROVIDER=claude`:** `claude-provider` returns a **fixed safe string** in `{ content }` (surfaced as the normal chat reply, typically HTTP **200**), **without** echoing env diagnostics or calling Anthropic.
- **Anthropic API errors** (rate limits, invalid request, auth): map to **controlled errors**; client sees **safe, generic** messaging.
- **Do not** expose upstream error bodies, internal ids, or stack traces to the client.
- **Server logs:** log **minimal** operational detail (e.g. status code, non-sensitive error type)—**not** API keys, full request bodies, or full prompts if they may contain user secrets.
- Never log **`ANTHROPIC_API_KEY`** or derivative auth headers.

## 8. Token Cost Policy

When real Claude is enabled, usage should follow a **lean context** policy:

- **Do not** send the full conversation history unbounded.
- **Do not** send entire attached documents or large blobs by default.
- Use a **minimal system prompt**; expand only when product requires it.
- When **persistence / summaries** exist in a later phase, prefer a **short summary** plus **only the last N user/assistant messages** over full history.
- Enforce a **bounded `max_tokens`** on completions.
- Prefer **concise default answers**; avoid encouraging unnecessarily long replies in prompts unless needed.

(Concrete N, summarization pipeline, and storage are out of scope for this spec; this section defines **policy** for the future provider implementation.)

## 9. Implementation Plan (status)

1. **Done:** Official **`@anthropic-ai/sdk`** dependency in `web/`.
2. **Done:** Real **`complete()`** in **`web/lib/ai/claude-provider.ts`** (same `{ content: string }` return type; no streaming/tools in this milestone).
3. **Done:** **`ANTHROPIC_API_KEY`** read from **`process.env`** on the server only.
4. **Done:** Optional **`ANTHROPIC_MODEL`** with default **`claude-haiku-4-5`** (§6).
5. **Done:** **`web/lib/ai/fake-provider.ts`** and **`AI_PROVIDER=stub`** (or empty / unknown) remain the **safe default** path.
6. **Recommended:** Test with **`AI_PROVIDER=stub`** (no external calls).
7. **Recommended:** Test with **`AI_PROVIDER=claude`** and key only in **`web/.env.local`** on trusted machines.
8. **Recommended:** Run **`npm run build`** from `web/` after changes.
9. **Recommended:** Verify **`POST /api/chat/turn`** (status codes, JSON shape, no key leakage).
10. Optional: extend docs/README with observed limits and errors.

## 10. Out of Scope

The following are **not** part of this specification’s delivery or the first Claude-real milestone unless explicitly added later:

- Supabase and other databases
- Durable **memory** / persistence
- **Real** automatic summarization pipelines
- Multi-**tenant** isolation
- End-user **auth**
- WhatsApp or other channels
- n8n or workflow automation
- Voice (ElevenLabs, Vapi, Retell, OpenAI Realtime, etc.)
- **Streaming** responses
- **Tools** and **function calling**
- **RAG** and retrieval systems
- File **upload** pipelines
- **Deploy** / infra provisioning

## 11. Verification Criteria

For the **Claude-real** milestone:

- **`docs/spec-claude-integration.md`** reflects implemented behavior (this file).
- **No real API keys** in the repo or examples; **`ANTHROPIC_API_KEY`** only in **`web/.env.local`** or host secrets.
- **`web/.env.local`** is git-ignored; **`web/.env.example`** lists variable names and safe placeholders only.
- From **`web/`**, **`npm run build`** completes successfully.
- **`AI_PROVIDER=stub`**: no Anthropic traffic; stub/fake replies as documented for the Chat MVP.
- **`AI_PROVIDER=claude`** with a valid key: **`POST /api/chat/turn`** returns **200** and real assistant text in the agreed JSON shape, without leaking credentials or raw upstream errors to the client.

---

*Document version: spec + implemented Claude path in `web/lib/ai/claude-provider.ts`; default remains stub for cost safety.*
