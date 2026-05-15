"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const LS_KEY = "cursor_chat_conversation_id";

/** Fila tal como la devuelve GET /api/chat/history */
type HistoryApiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type ChatMessage = {
  clientKey: string;
  role: "user" | "assistant";
  content: string;
};

type ConversationListItem = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_preview: string | null;
};

function newClientKey(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Primeros 8 caracteres del id + "..." (sin mostrar el UUID completo). */
function shortConversationIdPreview(id: string): string {
  const prefix = id.slice(0, 8);
  return `${prefix}...`;
}

function mapHistoryToChatMessages(rows: unknown): ChatMessage[] {
  if (!Array.isArray(rows)) return [];
  const out: ChatMessage[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<HistoryApiMessage>;
    if (typeof r.content !== "string") continue;
    if (r.role !== "user" && r.role !== "assistant") continue;
    const clientKey =
      typeof r.id === "string" && r.id.length > 0 ? r.id : newClientKey("h");
    out.push({ clientKey, role: r.role, content: r.content });
  }
  return out;
}

function mapConversations(rows: unknown): ConversationListItem[] {
  if (!Array.isArray(rows)) return [];
  const out: ConversationListItem[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<ConversationListItem>;
    if (
      typeof r.id !== "string" ||
      typeof r.created_at !== "string" ||
      typeof r.updated_at !== "string"
    ) {
      continue;
    }
    out.push({
      id: r.id,
      title: typeof r.title === "string" ? r.title : null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      last_message_preview:
        typeof r.last_message_preview === "string"
          ? r.last_message_preview
          : null,
    });
  }
  return out;
}

function getApiError(data: unknown, fallback: string): string {
  return data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
    ? (data as { error: string }).error
    : fallback;
}

function formatLocalDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

async function fetchHistoryMessages(conversationId: string): Promise<
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; error: string; notFound: boolean }
> {
  const res = await fetch(
    `/api/chat/history?conversation_id=${encodeURIComponent(conversationId)}`,
  );
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const error = getApiError(data, `Error ${res.status}`);
    return {
      ok: false,
      error,
      notFound: res.status === 404 || error === "conversation not found",
    };
  }

  if (data && typeof data === "object" && "messages" in data) {
    return {
      ok: true,
      messages: mapHistoryToChatMessages(
        (data as { messages: unknown }).messages,
      ),
    };
  }

  return {
    ok: false,
    error: "Respuesta de historial inesperada",
    notFound: false,
  };
}

async function fetchRecentConversations(): Promise<
  | { ok: true; conversations: ConversationListItem[] }
  | { ok: false; error: string }
> {
  const res = await fetch("/api/chat/conversations?limit=20");
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    return { ok: false, error: getApiError(data, `Error ${res.status}`) };
  }

  if (data && typeof data === "object" && "conversations" in data) {
    return {
      ok: true,
      conversations: mapConversations(
        (data as { conversations: unknown }).conversations,
      ),
    };
  }

  return { ok: false, error: "Respuesta de conversaciones inesperada" };
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationListItem[]>(
    [],
  );
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationSearchQuery, setConversationSearchQuery] = useState("");

  const filteredConversations = useMemo(() => {
    const q = conversationSearchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const title = (c.title ?? "").toLowerCase();
      const preview = (c.last_message_preview ?? "").toLowerCase();
      const id = c.id.toLowerCase();
      return title.includes(q) || preview.includes(q) || id.includes(q);
    });
  }, [conversations, conversationSearchQuery]);

  const loadConversations = useCallback(async () => {
    setConversationsLoading(true);
    try {
      const result = await fetchRecentConversations();
      if (result.ok) {
        setConversations(result.conversations);
      } else {
        setError(result.error);
      }
    } catch {
      setError("No se pudieron cargar las conversaciones recientes");
    } finally {
      setConversationsLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async (nextConversationId: string) => {
    setHistoryLoading(true);
    try {
      const result = await fetchHistoryMessages(nextConversationId);
      if (result.ok) {
        setMessages(result.messages);
        return;
      }

      setError(result.error);
      if (result.notFound) {
        try {
          localStorage.removeItem(LS_KEY);
        } catch {
          /* ignore */
        }
        setConversationId(null);
        setMessages([]);
      }
    } catch {
      setError("No se pudo cargar el historial");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    let stored = "";
    try {
      stored = localStorage.getItem(LS_KEY)?.trim() ?? "";
    } catch {
      stored = "";
    }

    queueMicrotask(() => {
      if (stored) {
        setConversationId(stored);
        void loadHistory(stored);
      }
      void loadConversations();
    });
  }, [loadConversations, loadHistory]);

  const selectConversation = useCallback(
    (nextConversationId: string) => {
      setError(null);
      setConversationId(nextConversationId);
      try {
        localStorage.setItem(LS_KEY, nextConversationId);
      } catch {
        /* ignore */
      }
      void loadHistory(nextConversationId);
    },
    [loadHistory],
  );

  const startNewConversation = useCallback(() => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      /* ignore */
    }
    setMessages([]);
    setConversationId(null);
    setError(null);
    setHistoryLoading(false);
  }, []);

  const send = useCallback(async () => {
    const content = input.trim();
    if (!content || pending) return;

    setInput("");
    setError(null);
    setMessages((prev) => [
      ...prev,
      { clientKey: newClientKey("u"), role: "user", content },
    ]);
    setPending(true);

    try {
      const payload: { content: string; conversation_id?: string } = {
        content,
      };
      if (conversationId) {
        payload.conversation_id = conversationId;
      }

      const res = await fetch("/api/chat/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `Error ${res.status}`;
        setError(msg);
        return;
      }

      if (
        data &&
        typeof data === "object" &&
        "reply" in data &&
        typeof (data as { reply: unknown }).reply === "string"
      ) {
        const reply = (data as { reply: string }).reply;
        const nextConvId = (data as { conversation_id?: unknown })
          .conversation_id;
        if (typeof nextConvId === "string" && nextConvId.length > 0) {
          setConversationId(nextConvId);
          try {
            localStorage.setItem(LS_KEY, nextConvId);
          } catch {
            /* ignore */
          }
          void loadConversations();
        }
        setMessages((prev) => [
          ...prev,
          { clientKey: newClientKey("a"), role: "assistant", content: reply },
        ]);
      } else {
        setError("Respuesta inesperada del servidor");
      }
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setPending(false);
    }
  }, [conversationId, input, loadConversations, pending]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-5 p-6">
      <header className="flex flex-col gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Chat
          </h1>
          <button
            type="button"
            onClick={startNewConversation}
            disabled={pending || historyLoading}
            className="shrink-0 self-start rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50 sm:self-auto dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Nueva conversación
          </button>
        </div>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Envía mensajes desde aquí; el historial se guarda en el servidor y
          puedes retomar conversaciones desde la lista.
        </p>
        <p
          className="text-xs text-zinc-500 dark:text-zinc-500"
          aria-live="polite"
        >
          {conversationId ? (
            <>
              Conversación activa:{" "}
              <span className="font-mono text-zinc-600 dark:text-zinc-400">
                {shortConversationIdPreview(conversationId)}
              </span>
            </>
          ) : (
            "Sin conversación activa"
          )}
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Conversaciones recientes
          </h2>
          {conversationsLoading ? (
            <span className="text-xs text-zinc-500 dark:text-zinc-500">
              Cargando…
            </span>
          ) : null}
        </div>
        {conversations.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            No hay conversaciones recientes.
          </p>
        ) : (
          <>
            <input
              type="search"
              value={conversationSearchQuery}
              onChange={(e) => setConversationSearchQuery(e.target.value)}
              placeholder="Buscar conversación..."
              className="mb-4 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              aria-label="Buscar en conversaciones recientes"
            />
            {filteredConversations.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-500">
                No se encontraron conversaciones
              </p>
            ) : (
              <ul className="flex max-h-48 flex-col gap-2.5 overflow-y-auto pr-0.5">
                {filteredConversations.map((conversation) => {
                  const active = conversation.id === conversationId;
                  const trimmedTitle = conversation.title?.trim();
                  const displayTitle =
                    trimmedTitle && trimmedTitle.length > 0
                      ? trimmedTitle
                      : shortConversationIdPreview(conversation.id);
                  const isIdFallback =
                    !trimmedTitle || trimmedTitle.length === 0;
                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => selectConversation(conversation.id)}
                        disabled={pending || historyLoading}
                        className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition disabled:opacity-50 ${
                          active
                            ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                            : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                        }`}
                      >
                        <span className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
                          <span
                            className={`min-w-0 flex-1 truncate text-zinc-900 dark:text-zinc-100 ${
                              isIdFallback
                                ? "font-mono text-xs text-zinc-700 dark:text-zinc-300"
                                : "text-sm font-medium"
                            }`}
                            title={displayTitle}
                          >
                            {displayTitle}
                          </span>
                          <span
                            className="shrink-0 text-xs text-zinc-500 dark:text-zinc-500"
                            suppressHydrationWarning
                          >
                            {formatLocalDate(conversation.updated_at)}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-xs text-zinc-600 dark:text-zinc-400">
                          {conversation.last_message_preview ||
                            "Sin vista previa"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>

      <ul className="flex min-h-[12rem] flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {historyLoading ? (
          <li className="text-sm text-zinc-500 dark:text-zinc-500">
            Cargando historial…
          </li>
        ) : messages.length === 0 ? (
          <li className="flex flex-1 flex-col items-center justify-center gap-1 px-2 py-8 text-center text-sm text-zinc-500 dark:text-zinc-500">
            <span className="max-w-sm">
              Selecciona una conversación o escribe un mensaje para empezar.
            </span>
          </li>
        ) : (
          messages.map((m) => (
            <li
              key={m.clientKey}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "self-end bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "self-start bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
              }`}
            >
              <span className="mb-1 block text-xs font-medium opacity-70">
                {m.role === "user" ? "Tú" : "Asistente"}
              </span>
              {m.content}
            </li>
          ))
        )}
        {pending ? (
          <li
            className="self-start max-w-[85%] rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 italic dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400"
            aria-live="polite"
          >
            Pensando…
          </li>
        ) : null}
      </ul>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-stretch"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe un mensaje…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          disabled={pending || historyLoading}
          aria-label="Mensaje"
        />
        <button
          type="submit"
          disabled={pending || historyLoading || !input.trim()}
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Enviando…" : "Enviar"}
        </button>
      </form>
    </div>
  );
}
