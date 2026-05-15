import {
  FOLLOW_UP_TASK_PRIORITIES,
  FOLLOW_UP_TASK_SOURCES,
  FOLLOW_UP_TASK_STATUSES,
  followUpTasksErrorMessages,
  type FollowUpTaskPriority,
  type FollowUpTaskSource,
  type FollowUpTaskStatus,
  type CreateFollowUpTaskInput,
  type CreateFollowUpTaskValidationResult,
} from "./types";

const OPTIONAL_STRING_FIELDS = ["description"] as const;

const OPTIONAL_DATE_FIELDS = ["due_at", "completed_at"] as const;

type OptionalStringField = (typeof OPTIONAL_STRING_FIELDS)[number];
type OptionalDateField = (typeof OPTIONAL_DATE_FIELDS)[number];

const STATUS_SET = new Set<string>(FOLLOW_UP_TASK_STATUSES);
const PRIORITY_SET = new Set<string>(FOLLOW_UP_TASK_PRIORITIES);
const SOURCE_SET = new Set<string>(FOLLOW_UP_TASK_SOURCES);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

function validateMetadata(value: unknown): CreateFollowUpTaskValidationResult | null {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return {
      ok: false,
      error: followUpTasksErrorMessages.metadataCannotBeString,
      code: "METADATA_INVALID",
    };
  }
  if (Array.isArray(value)) {
    return {
      ok: false,
      error: followUpTasksErrorMessages.metadataCannotBeArray,
      code: "METADATA_INVALID",
    };
  }
  if (!isPlainObject(value)) {
    return {
      ok: false,
      error: followUpTasksErrorMessages.metadataMustBeObject,
      code: "METADATA_INVALID",
    };
  }
  return null;
}

function normalizeOptionalString(
  raw: unknown,
  field: OptionalStringField,
): CreateFollowUpTaskValidationResult | string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: followUpTasksErrorMessages.fieldMustBeStringOrNull(field),
      code: "FIELD_INVALID_TYPE",
    };
  }
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function normalizeOptionalIsoDate(
  raw: unknown,
  field: OptionalDateField,
): CreateFollowUpTaskValidationResult | string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: followUpTasksErrorMessages.dateInvalid(field),
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
      error: followUpTasksErrorMessages.dateInvalid(field),
      code: "DATE_INVALID",
    };
  }
  return trimmed;
}

function resolveContactId(
  raw: unknown,
): CreateFollowUpTaskValidationResult | string | null | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: followUpTasksErrorMessages.contactIdInvalid,
      code: "CONTACT_ID_INVALID",
    };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  if (!isValidUuid(trimmed)) {
    return {
      ok: false,
      error: followUpTasksErrorMessages.contactIdInvalid,
      code: "CONTACT_ID_INVALID",
    };
  }
  return trimmed;
}

function resolveStatus(raw: unknown): CreateFollowUpTaskValidationResult | FollowUpTaskStatus {
  if (raw === undefined || raw === null) {
    return "open";
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: followUpTasksErrorMessages.statusInvalid,
      code: "STATUS_INVALID",
    };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return "open";
  }
  if (!STATUS_SET.has(trimmed)) {
    return {
      ok: false,
      error: followUpTasksErrorMessages.statusInvalid,
      code: "STATUS_INVALID",
    };
  }
  return trimmed as FollowUpTaskStatus;
}

function resolvePriority(
  raw: unknown,
): CreateFollowUpTaskValidationResult | FollowUpTaskPriority {
  if (raw === undefined || raw === null) {
    return "normal";
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: followUpTasksErrorMessages.priorityInvalid,
      code: "PRIORITY_INVALID",
    };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return "normal";
  }
  if (!PRIORITY_SET.has(trimmed)) {
    return {
      ok: false,
      error: followUpTasksErrorMessages.priorityInvalid,
      code: "PRIORITY_INVALID",
    };
  }
  return trimmed as FollowUpTaskPriority;
}

function resolveSource(
  raw: unknown,
): CreateFollowUpTaskValidationResult | FollowUpTaskSource | null | undefined {
  if (raw === undefined) {
    return undefined;
  }
  if (raw === null) {
    return null;
  }
  if (typeof raw !== "string") {
    return {
      ok: false,
      error: followUpTasksErrorMessages.sourceInvalid,
      code: "SOURCE_INVALID",
    };
  }
  const trimmed = raw.trim();
  if (trimmed === "") {
    return null;
  }
  if (!SOURCE_SET.has(trimmed)) {
    return {
      ok: false,
      error: followUpTasksErrorMessages.sourceInvalid,
      code: "SOURCE_INVALID",
    };
  }
  return trimmed as FollowUpTaskSource;
}

/**
 * Valida y normaliza el body ya parseado de `POST /api/follow-up-tasks`.
 * El JSON inválido se maneja en el Route Handler (antes de llamar aquí).
 */
export function validateCreateFollowUpTaskBody(
  body: unknown,
): CreateFollowUpTaskValidationResult {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      error: followUpTasksErrorMessages.titleRequired,
      code: "TITLE_REQUIRED",
    };
  }

  const record = body as Record<string, unknown>;

  if (!("title" in record)) {
    return {
      ok: false,
      error: followUpTasksErrorMessages.titleRequired,
      code: "TITLE_REQUIRED",
    };
  }

  const rawTitle = record.title;
  if (typeof rawTitle !== "string") {
    return {
      ok: false,
      error: followUpTasksErrorMessages.titleMustBeString,
      code: "TITLE_NOT_STRING",
    };
  }

  const title = rawTitle.trim();
  if (title === "") {
    return {
      ok: false,
      error: followUpTasksErrorMessages.titleCannotBeEmpty,
      code: "TITLE_EMPTY",
    };
  }

  const input: CreateFollowUpTaskInput = { title };

  if ("contact_id" in record) {
    const contactIdResult = resolveContactId(record.contact_id);
    if (
      contactIdResult !== undefined &&
      contactIdResult !== null &&
      typeof contactIdResult !== "string"
    ) {
      return contactIdResult;
    }
    if (contactIdResult !== undefined) {
      input.contact_id = contactIdResult;
    }
  }

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

  const priorityResult = resolvePriority(record.priority);
  if (typeof priorityResult !== "string") {
    return priorityResult;
  }
  input.priority = priorityResult;

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

  if ("source" in record) {
    const sourceResult = resolveSource(record.source);
    if (
      sourceResult !== undefined &&
      sourceResult !== null &&
      typeof sourceResult !== "string"
    ) {
      return sourceResult;
    }
    if (sourceResult !== undefined) {
      input.source = sourceResult;
    }
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
