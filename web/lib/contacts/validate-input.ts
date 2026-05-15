import {
  CONTACT_STATUSES,
  CONTACT_TYPES,
  contactsErrorMessages,
  type ContactStatus,
  type ContactType,
  type CreateContactInput,
  type CreateContactValidationResult,
} from "./types";

const OPTIONAL_STRING_FIELDS = [
  "email",
  "phone",
  "source",
  "interest",
  "notes",
] as const;

const OPTIONAL_DATE_FIELDS = [
  "last_contacted_at",
  "next_follow_up_at",
] as const;

type OptionalStringField = (typeof OPTIONAL_STRING_FIELDS)[number];
type OptionalDateField = (typeof OPTIONAL_DATE_FIELDS)[number];

const STATUS_SET = new Set<string>(CONTACT_STATUSES);
const CONTACT_TYPE_SET = new Set<string>(CONTACT_TYPES);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateMetadata(value: unknown): CreateContactValidationResult | null {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return {
      ok: false,
      error: contactsErrorMessages.metadataCannotBeString,
      code: "METADATA_INVALID",
    };
  }
  if (Array.isArray(value)) {
    return {
      ok: false,
      error: contactsErrorMessages.metadataCannotBeArray,
      code: "METADATA_INVALID",
    };
  }
  if (!isPlainObject(value)) {
    return {
      ok: false,
      error: contactsErrorMessages.metadataMustBeObject,
      code: "METADATA_INVALID",
    };
  }
  return null;
}

function normalizeOptionalString(
  raw: unknown,
  field: OptionalStringField,
): CreateContactValidationResult | string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: contactsErrorMessages.fieldMustBeStringOrNull(field),
      code: "FIELD_INVALID_TYPE",
    };
  }
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeOptionalIsoDate(
  raw: unknown,
  field: OptionalDateField,
): CreateContactValidationResult | string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: contactsErrorMessages.dateInvalid(field),
      code: "DATE_INVALID",
    };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return {
      ok: false,
      error: contactsErrorMessages.dateInvalid(field),
      code: "DATE_INVALID",
    };
  }
  return trimmed;
}

function resolveStatus(raw: unknown): CreateContactValidationResult | ContactStatus {
  if (raw === undefined || raw === null) {
    return "new";
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: contactsErrorMessages.statusInvalid,
      code: "STATUS_INVALID",
    };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return "new";
  }
  if (!STATUS_SET.has(trimmed)) {
    return {
      ok: false,
      error: contactsErrorMessages.statusInvalid,
      code: "STATUS_INVALID",
    };
  }
  return trimmed as ContactStatus;
}

function resolveContactType(
  raw: unknown,
): CreateContactValidationResult | ContactType | null | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: contactsErrorMessages.contactTypeInvalid,
      code: "CONTACT_TYPE_INVALID",
    };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  if (!CONTACT_TYPE_SET.has(trimmed)) {
    return {
      ok: false,
      error: contactsErrorMessages.contactTypeInvalid,
      code: "CONTACT_TYPE_INVALID",
    };
  }
  return trimmed as ContactType;
}

/**
 * Valida y normaliza el body ya parseado de `POST /api/contacts`.
 * El JSON inválido se maneja en el Route Handler (antes de llamar aquí).
 */
export function validateCreateContactBody(
  body: unknown,
): CreateContactValidationResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      error: contactsErrorMessages.nameRequired,
      code: "NAME_REQUIRED",
    };
  }

  const record = body as Record<string, unknown>;

  if (!("name" in record)) {
    return {
      ok: false,
      error: contactsErrorMessages.nameRequired,
      code: "NAME_REQUIRED",
    };
  }

  const rawName = record.name;
  if (typeof rawName !== "string") {
    return {
      ok: false,
      error: contactsErrorMessages.nameMustBeString,
      code: "NAME_NOT_STRING",
    };
  }

  const name = rawName.trim();
  if (name === "") {
    return {
      ok: false,
      error: contactsErrorMessages.nameCannotBeEmpty,
      code: "NAME_EMPTY",
    };
  }

  const input: CreateContactInput = { name };

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

  const statusResult = resolveStatus(record.status);
  if (typeof statusResult !== "string") {
    return statusResult;
  }
  input.status = statusResult;

  if ("contact_type" in record) {
    const contactTypeResult = resolveContactType(record.contact_type);
    if (
      contactTypeResult !== undefined &&
      contactTypeResult !== null &&
      typeof contactTypeResult !== "string"
    ) {
      return contactTypeResult;
    }
    if (contactTypeResult !== undefined) {
      input.contact_type = contactTypeResult;
    }
  }

  for (const field of OPTIONAL_DATE_FIELDS) {
    if (!(field in record)) {
      continue;
    }
    const normalized = normalizeOptionalIsoDate(record[field], field);
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
