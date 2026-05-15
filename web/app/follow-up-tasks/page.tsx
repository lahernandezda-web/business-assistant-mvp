"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ModuleNav } from "@/components/module-nav";
import type { Contact } from "@/lib/contacts/types";
import type {
  FollowUpTask,
  FollowUpTaskPriority,
  FollowUpTaskSource,
  FollowUpTaskStatus,
} from "@/lib/follow-up-tasks/types";
import {
  FOLLOW_UP_TASK_PRIORITIES,
  FOLLOW_UP_TASK_SOURCES,
  FOLLOW_UP_TASK_STATUSES,
} from "@/lib/follow-up-tasks/types";

type FormValues = {
  title: string;
  description: string;
  contact_id: string;
  status: FollowUpTaskStatus;
  priority: FollowUpTaskPriority;
  due_at: string;
  source: FollowUpTaskSource;
};

const emptyForm: FormValues = {
  title: "",
  description: "",
  contact_id: "",
  status: "open",
  priority: "normal",
  due_at: "",
  source: "manual",
};

function optionalField(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formToPayload(form: FormValues) {
  const payload: Record<string, unknown> = {
    title: form.title.trim(),
    description: optionalField(form.description),
    contact_id: form.contact_id.trim() ? form.contact_id.trim() : null,
    status: form.status,
    priority: form.priority,
    source: form.source,
    due_at: null,
  };

  if (form.due_at.trim()) {
    const parsed = new Date(form.due_at);
    if (!Number.isNaN(parsed.getTime())) {
      payload.due_at = parsed.toISOString();
    }
  }

  return payload;
}

function getApiError(data: unknown, fallback: string): string {
  return data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
    ? (data as { error: string }).error
    : fallback;
}

function isContact(value: unknown): value is Contact {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<Contact>;
  return typeof c.id === "string" && typeof c.name === "string";
}

function isContactArray(value: unknown): value is Contact[] {
  return Array.isArray(value) && value.every(isContact);
}

function isFollowUpTask(value: unknown): value is FollowUpTask {
  if (!value || typeof value !== "object") return false;
  const t = value as Partial<FollowUpTask>;
  return typeof t.id === "string" && typeof t.title === "string";
}

function isFollowUpTaskArray(value: unknown): value is FollowUpTask[] {
  return Array.isArray(value) && value.every(isFollowUpTask);
}

/** Formato estable servidor/cliente (evita hydration mismatch con toLocaleString). */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().replace("T", " ").slice(0, 16);
}

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

const textareaClassName = `${inputClassName} min-h-[5rem] resize-y`;

const selectClassName = inputClassName;

const STATUS_LABELS: Record<FollowUpTaskStatus, string> = {
  open: "Abierta",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
  archived: "Archivada",
};

const PRIORITY_LABELS: Record<FollowUpTaskPriority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

const SOURCE_LABELS: Record<FollowUpTaskSource, string> = {
  manual: "Manual",
  chat_suggestion: "Sugerida por chat",
  system: "Sistema",
};

export default function FollowUpTasksPage() {
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const contactNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const contact of contacts) {
      map.set(contact.id, contact.name);
    }
    return map;
  }, [contacts]);

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    setError(null);

    try {
      const res = await fetch("/api/follow-up-tasks");
      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        setTasks([]);
        setError(getApiError(data, "No se pudieron cargar las tareas de seguimiento"));
        return;
      }

      if (
        data &&
        typeof data === "object" &&
        "tasks" in data &&
        isFollowUpTaskArray((data as { tasks: unknown }).tasks)
      ) {
        setTasks((data as { tasks: FollowUpTask[] }).tasks);
      } else {
        setTasks([]);
        setError("Respuesta inesperada del servidor");
      }
    } catch {
      setTasks([]);
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);

    try {
      const res = await fetch("/api/contacts");
      const data: unknown = await res.json().catch(() => null);

      if (
        res.ok &&
        data &&
        typeof data === "object" &&
        "contacts" in data &&
        isContactArray((data as { contacts: unknown }).contacts)
      ) {
        setContacts((data as { contacts: Contact[] }).contacts);
      } else {
        setContacts([]);
      }
    } catch {
      setContacts([]);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadTasks();
      void loadContacts();
    });
  }, [loadTasks, loadContacts]);

  const updateField = useCallback(
    <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setSuccess(false);
    },
    [],
  );

  const saveTask = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving || loadingTasks) return;

      const title = form.title.trim();
      if (!title) {
        setError("El título es obligatorio");
        setSuccess(false);
        return;
      }

      setSaving(true);
      setError(null);
      setSuccess(false);

      try {
        const res = await fetch("/api/follow-up-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formToPayload(form)),
        });

        const data: unknown = await res.json().catch(() => null);

        if (!res.ok) {
          setError(getApiError(data, "No se pudo guardar la tarea de seguimiento"));
          return;
        }

        if (
          data &&
          typeof data === "object" &&
          "task" in data &&
          isFollowUpTask((data as { task: unknown }).task)
        ) {
          const task = (data as { task: FollowUpTask }).task;
          setTasks((prev) => [
            task,
            ...prev.filter((t) => t.id !== task.id),
          ]);
          setForm(emptyForm);
          setSuccess(true);
        } else {
          setError("Respuesta inesperada del servidor");
        }
      } catch {
        setError("No se pudo conectar con el servidor");
      } finally {
        setSaving(false);
      }
    },
    [form, loadingTasks, saving],
  );

  const disabled = loadingTasks || saving;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <ModuleNav />
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Tareas de seguimiento
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Acciones simples de seguimiento para no perder oportunidades
          comerciales o administrativas.
        </p>
      </header>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        Usa las tareas de seguimiento solo para acciones administrativas o
        comerciales. No guardes historias clínicas, diagnósticos, tratamientos,
        tarjetas de pago ni documentos sensibles.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Tareas recientes
        </h2>

        {loadingTasks ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-500" aria-live="polite">
            Cargando tareas…
          </p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
            Todavía no hay tareas de seguimiento.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {task.title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    {formatDate(task.created_at)}
                  </p>
                </div>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Estado:</span>{" "}
                  {STATUS_LABELS[task.status] ?? task.status}
                  {" · "}
                  <span className="font-medium">Prioridad:</span>{" "}
                  {PRIORITY_LABELS[task.priority] ?? task.priority}
                </p>
                {task.contact_id ? (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium">Contacto:</span>{" "}
                    {contactNameById.get(task.contact_id) ??
                      "Contacto no disponible"}
                  </p>
                ) : null}
                {task.due_at ? (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium">Fecha límite:</span>{" "}
                    {formatDate(task.due_at)}
                  </p>
                ) : null}
                {task.description ? (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {task.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={(e) => void saveTask(e)}
        className="flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Crear tarea de seguimiento
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Título <span className="text-red-600 dark:text-red-400">*</span>
            </span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              disabled={disabled}
              required
              className={inputClassName}
              aria-required="true"
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Descripción
            </span>
            <textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              disabled={disabled}
              className={textareaClassName}
              rows={3}
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Contacto
            </span>
            <select
              value={form.contact_id}
              onChange={(e) => updateField("contact_id", e.target.value)}
              disabled={disabled || loadingContacts}
              className={selectClassName}
            >
              <option value="">Sin contacto</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Estado
            </span>
            <select
              value={form.status}
              onChange={(e) =>
                updateField("status", e.target.value as FollowUpTaskStatus)
              }
              disabled={disabled}
              className={selectClassName}
            >
              {FOLLOW_UP_TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Prioridad
            </span>
            <select
              value={form.priority}
              onChange={(e) =>
                updateField("priority", e.target.value as FollowUpTaskPriority)
              }
              disabled={disabled}
              className={selectClassName}
            >
              {FOLLOW_UP_TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Fuente
            </span>
            <select
              value={form.source}
              onChange={(e) =>
                updateField("source", e.target.value as FollowUpTaskSource)
              }
              disabled={disabled}
              className={selectClassName}
            >
              {FOLLOW_UP_TASK_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {SOURCE_LABELS[source]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Fecha límite
            </span>
            <input
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => updateField("due_at", e.target.value)}
              disabled={disabled}
              className={inputClassName}
            />
          </label>
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        {success ? (
          <p
            className="text-sm text-emerald-700 dark:text-emerald-400"
            role="status"
            aria-live="polite"
          >
            Tarea de seguimiento guardada.
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={disabled || !form.title.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Guardando…" : "Guardar tarea"}
          </button>
          {saving ? (
            <span className="text-sm text-zinc-500 dark:text-zinc-500" aria-live="polite">
              Guardando tarea…
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
