"use client";

import { useCallback, useEffect, useState } from "react";

import { ModuleNav } from "@/components/module-nav";
import type { BusinessProfile } from "@/lib/business-profile/types";

type FormValues = {
  name: string;
  industry: string;
  description: string;
  target_customer: string;
  tone: string;
  services: string;
  location: string;
  website: string;
};

const emptyForm: FormValues = {
  name: "",
  industry: "",
  description: "",
  target_customer: "",
  tone: "",
  services: "",
  location: "",
  website: "",
};

function profileToForm(profile: BusinessProfile): FormValues {
  return {
    name: profile.name,
    industry: profile.industry ?? "",
    description: profile.description ?? "",
    target_customer: profile.target_customer ?? "",
    tone: profile.tone ?? "",
    services: profile.services ?? "",
    location: profile.location ?? "",
    website: profile.website ?? "",
  };
}

function optionalField(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formToPayload(form: FormValues) {
  return {
    name: form.name.trim(),
    industry: optionalField(form.industry),
    description: optionalField(form.description),
    target_customer: optionalField(form.target_customer),
    tone: optionalField(form.tone),
    services: optionalField(form.services),
    location: optionalField(form.location),
    website: optionalField(form.website),
  };
}

function getApiError(data: unknown, fallback: string): string {
  return data &&
    typeof data === "object" &&
    "error" in data &&
    typeof (data as { error: unknown }).error === "string"
    ? (data as { error: string }).error
    : fallback;
}

function isBusinessProfile(value: unknown): value is BusinessProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<BusinessProfile>;
  return typeof p.id === "string" && typeof p.name === "string";
}

const inputClassName =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50";

const textareaClassName = `${inputClassName} min-h-[6rem] resize-y`;

export default function BusinessProfilePage() {
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [hasProfile, setHasProfile] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/business-profile");
      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        setError(getApiError(data, "No se pudo cargar el perfil del negocio"));
        setForm(emptyForm);
        setHasProfile(false);
        return;
      }

      if (
        data &&
        typeof data === "object" &&
        "profile" in data &&
        data.profile !== null &&
        isBusinessProfile((data as { profile: unknown }).profile)
      ) {
        const profile = (data as { profile: BusinessProfile }).profile;
        setForm(profileToForm(profile));
        setHasProfile(true);
      } else {
        setForm(emptyForm);
        setHasProfile(false);
      }
    } catch {
      setError("No se pudo conectar con el servidor");
      setForm(emptyForm);
      setHasProfile(false);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadProfile();
    });
  }, [loadProfile]);

  const updateField = useCallback(
    (field: keyof FormValues, value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      setSuccess(false);
    },
    [],
  );

  const saveProfile = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving || loadingProfile) return;

      const name = form.name.trim();
      if (!name) {
        setError("El nombre es obligatorio");
        setSuccess(false);
        return;
      }

      setSaving(true);
      setError(null);
      setSuccess(false);

      try {
        const res = await fetch("/api/business-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formToPayload(form)),
        });

        const data: unknown = await res.json().catch(() => null);

        if (!res.ok) {
          setError(getApiError(data, "No se pudo guardar el perfil del negocio"));
          return;
        }

        if (
          data &&
          typeof data === "object" &&
          "profile" in data &&
          isBusinessProfile((data as { profile: unknown }).profile)
        ) {
          const profile = (data as { profile: BusinessProfile }).profile;
          setForm(profileToForm(profile));
          setHasProfile(true);
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
    [form, loadingProfile, saving],
  );

  const disabled = loadingProfile || saving;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <ModuleNav />
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Perfil del negocio
        </h1>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          Contexto básico del negocio que usa el asistente para responder de
          forma más personalizada.
        </p>
      </header>

      {loadingProfile ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-500" aria-live="polite">
          Cargando perfil…
        </p>
      ) : hasProfile ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
          Perfil actual cargado.
        </p>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
          Todavía no hay perfil del negocio creado.
        </p>
      )}

      <form
        onSubmit={(e) => void saveProfile(e)}
        className="flex flex-col gap-5 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Nombre <span className="text-red-600 dark:text-red-400">*</span>
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
              Sector
            </span>
            <input
              type="text"
              value={form.industry}
              onChange={(e) => updateField("industry", e.target.value)}
              disabled={disabled}
              className={inputClassName}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Tono
            </span>
            <input
              type="text"
              value={form.tone}
              onChange={(e) => updateField("tone", e.target.value)}
              disabled={disabled}
              className={inputClassName}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Ubicación
            </span>
            <input
              type="text"
              value={form.location}
              onChange={(e) => updateField("location", e.target.value)}
              disabled={disabled}
              className={inputClassName}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Sitio web
            </span>
            <input
              type="url"
              value={form.website}
              onChange={(e) => updateField("website", e.target.value)}
              disabled={disabled}
              className={inputClassName}
              placeholder="https://"
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
              rows={4}
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Cliente objetivo
            </span>
            <textarea
              value={form.target_customer}
              onChange={(e) => updateField("target_customer", e.target.value)}
              disabled={disabled}
              className={textareaClassName}
              rows={3}
            />
          </label>

          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Servicios
            </span>
            <textarea
              value={form.services}
              onChange={(e) => updateField("services", e.target.value)}
              disabled={disabled}
              className={textareaClassName}
              rows={3}
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
            Perfil guardado.
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={disabled || !form.name.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Guardando…" : "Guardar perfil"}
          </button>
          {saving ? (
            <span className="text-sm text-zinc-500 dark:text-zinc-500" aria-live="polite">
              Guardando perfil…
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
