import {
  businessProfileErrorMessages,
  type CreateBusinessProfileInput,
  type CreateBusinessProfileValidationResult,
} from "./types";

const OPTIONAL_STRING_FIELDS = [
  "industry",
  "description",
  "target_customer",
  "tone",
  "services",
  "location",
  "website",
] as const;

type OptionalStringField = (typeof OPTIONAL_STRING_FIELDS)[number];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Valida que `metadata` sea un objeto JSON plano: sin arrays en el valor raíz
 * ni como tipo de campo, y sin strings como valor raíz del campo.
 */
function validateMetadata(value: unknown): CreateBusinessProfileValidationResult | null {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return {
      ok: false,
      error: businessProfileErrorMessages.metadataCannotBeString,
      code: "METADATA_INVALID",
    };
  }
  if (Array.isArray(value)) {
    return {
      ok: false,
      error: businessProfileErrorMessages.metadataCannotBeArray,
      code: "METADATA_INVALID",
    };
  }
  if (!isPlainObject(value)) {
    return {
      ok: false,
      error: businessProfileErrorMessages.metadataMustBeObject,
      code: "METADATA_INVALID",
    };
  }
  return null;
}

function normalizeOptionalString(
  raw: unknown,
  field: OptionalStringField,
): CreateBusinessProfileValidationResult | string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: businessProfileErrorMessages.fieldMustBeStringOrNull(field),
      code: "FIELD_INVALID_TYPE",
    };
  }
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Valida y normaliza el body ya parseado de `POST /api/business-profile`.
 * El JSON inválido se maneja en el Route Handler (antes de llamar aquí).
 */
export function validateCreateBusinessProfileBody(
  body: unknown,
): CreateBusinessProfileValidationResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      error: businessProfileErrorMessages.nameRequired,
      code: "NAME_REQUIRED",
    };
  }

  const record = body as Record<string, unknown>;

  if (!("name" in record)) {
    return {
      ok: false,
      error: businessProfileErrorMessages.nameRequired,
      code: "NAME_REQUIRED",
    };
  }

  const rawName = record.name;
  if (typeof rawName !== "string") {
    return {
      ok: false,
      error: businessProfileErrorMessages.nameMustBeString,
      code: "NAME_NOT_STRING",
    };
  }

  const name = rawName.trim();
  if (name === "") {
    return {
      ok: false,
      error: businessProfileErrorMessages.nameCannotBeEmpty,
      code: "NAME_EMPTY",
    };
  }

  const input: CreateBusinessProfileInput = { name };

  for (const field of OPTIONAL_STRING_FIELDS) {
    if (!(field in record)) {
      continue;
    }
    const normalized = normalizeOptionalString(record[field], field);
    if (typeof normalized !== "string" && normalized !== null) {
      return normalized;
    }
    input[field] = normalized;
  }

  if ("metadata" in record) {
    const metadataError = validateMetadata(record.metadata);
    if (metadataError) {
      return metadataError;
    }
    if (record.metadata !== undefined && record.metadata !== null) {
      input.metadata = record.metadata as Record<string, unknown>;
    }
  }

  return { ok: true, input };
}
