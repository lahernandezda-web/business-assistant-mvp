"use client";

import { useCallback, useEffect, useState } from "react";

import type { Contact, ContactStatus, ContactType } from "@/lib/contacts/types";
import { CONTACT_STATUSES, CONTACT_TYPES } from "@/lib/contacts/types";

type FormValues = {
  name: string;
  email: string;
  phone: string;
  source: string;
  status: ContactStatus;
  contact_type: ContactType | "";
  interest: string;
  notes: string;
  next_follow_up_at: string;
};

const emptyForm: FormValues = {
  name: "",
  email: "",
  phone: "",
  source: "",
  status: "new",
  contact_type: "lead",
  interest: "",
  notes: "",
  next_follow_up_at: "",
};

function optionalField(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formToPayload(form: FormValues) {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    email: optionalField(form.email),
    phone: optionalField(form.phone),
    source: optionalField(form.source),
    status: form.status,
    contact_type: form.contact_type === "" ? null : form.contact_type,
    interest: optionalField(form.interest),
    notes: optionalField(form.notes),
    next_follow_up_at: null,
  };

  if (form.next_follow_up_at.trim()) {
    const parsed = new Date(form.next_follow_up_at);
    if (!Number.isNaN(parsed.getTime())) {
      payload.next_follow_up_at = parsed.toISOString();
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

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

const textareaClassName = `${inputClassName} min-h-[5rem] resize-y`;

const selectClassName = inputClassName;

const STATUS_LABELS: Record<ContactStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  not_interested: "Not interested",
  converted: "Converted",
  archived: "Archived",
};

const TYPE_LABELS: Record<ContactType, string> = {
  lead: "Lead",
  customer: "Customer",
  patient: "Patient",
  supplier: "Supplier",
  other: "Other",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    setError(null);

    try {
      const res = await fetch("/api/contacts");
      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        setContacts([]);
        setError(getApiError(data, "Could not load contacts"));
        return;
      }

      if (
        data &&
        typeof data === "object" &&
        "contacts" in data &&
        isContactArray((data as { contacts: unknown }).contacts)
      ) {
        setContacts((data as { contacts: Contact[] }).contacts);
      } else {
        setContacts([]);
        setError("Unexpected response from the server");
      }
    } catch {
      setContacts([]);
      setError("Could not connect to the server");
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadContacts();
    });
  }, [loadContacts]);

  const updateField = useCallback(
    <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setSuccess(false);
    },
    [],
  );

  const saveContact = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving || loadingContacts) return;

      const name = form.name.trim();
      if (!name) {
        setError("Name is required");
        setSuccess(false);
        return;
      }

      setSaving(true);
      setError(null);
      setSuccess(false);

      try {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formToPayload(form)),
        });

        const data: unknown = await res.json().catch(() => null);

        if (!res.ok) {
          setError(getApiError(data, "Could not save contact"));
          return;
        }

        if (
          data &&
          typeof data === "object" &&
          "contact" in data &&
          isContact((data as { contact: unknown }).contact)
        ) {
          const contact = (data as { contact: Contact }).contact;
          setContacts((prev) => [
            contact,
            ...prev.filter((c) => c.id !== contact.id),
          ]);
          setForm(emptyForm);
          setSuccess(true);
        } else {
          setError("Unexpected response from the server");
        }
      } catch {
        setError("Could not connect to the server");
      } finally {
        setSaving(false);
      }
    },
    [form, loadingContacts, saving],
  );

  const disabled = loadingContacts || saving;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Contacts
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Simple contact records for commercial and administrative follow-up.
        </p>
      </header>

      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        Use contacts for administrative or commercial information only. Do not
        store clinical records, diagnoses, treatment details, payment cards, or
        sensitive documents.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Recent contacts
        </h2>

        {loadingContacts ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-500" aria-live="polite">
            Loading contacts...
          </p>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
            No contacts yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {contacts.map((contact) => (
              <li
                key={contact.id}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {contact.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500">
                    {formatDate(contact.created_at)}
                  </p>
                </div>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Status:</span>{" "}
                  {STATUS_LABELS[contact.status] ?? contact.status}
                  {contact.contact_type ? (
                    <>
                      {" "}
                      · <span className="font-medium">Type:</span>{" "}
                      {TYPE_LABELS[contact.contact_type] ?? contact.contact_type}
                    </>
                  ) : null}
                </p>
                {contact.phone || contact.email ? (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {[contact.phone, contact.email].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
                {contact.interest ? (
                  <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {contact.interest}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={(e) => void saveContact(e)}
        className="flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          Create contact
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Name <span className="text-red-600 dark:text-red-400">*</span>
            </span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              disabled={disabled}
              required
              className={inputClassName}
              aria-required="true"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Email
            </span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              disabled={disabled}
              className={inputClassName}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Phone
            </span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              disabled={disabled}
              className={inputClassName}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Source
            </span>
            <input
              type="text"
              value={form.source}
              onChange={(e) => updateField("source", e.target.value)}
              disabled={disabled}
              className={inputClassName}
              placeholder="manual, web, referral…"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Status
            </span>
            <select
              value={form.status}
              onChange={(e) =>
                updateField("status", e.target.value as ContactStatus)
              }
              disabled={disabled}
              className={selectClassName}
            >
              {CONTACT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Contact type
            </span>
            <select
              value={form.contact_type}
              onChange={(e) =>
                updateField(
                  "contact_type",
                  e.target.value as ContactType | "",
                )
              }
              disabled={disabled}
              className={selectClassName}
            >
              <option value="">—</option>
              {CONTACT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Interest
            </span>
            <input
              type="text"
              value={form.interest}
              onChange={(e) => updateField("interest", e.target.value)}
              disabled={disabled}
              className={inputClassName}
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Notes
            </span>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              disabled={disabled}
              className={textareaClassName}
              rows={3}
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Next follow-up
            </span>
            <input
              type="datetime-local"
              value={form.next_follow_up_at}
              onChange={(e) => updateField("next_follow_up_at", e.target.value)}
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
            Contact saved.
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={disabled || !form.name.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Saving…" : "Save contact"}
          </button>
          {saving ? (
            <span className="text-sm text-zinc-500 dark:text-zinc-500" aria-live="polite">
              Saving contact...
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
