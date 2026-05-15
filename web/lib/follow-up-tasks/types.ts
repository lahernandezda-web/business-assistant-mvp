/** Mensajes de error expuestos por `POST /api/follow-up-tasks` (contrato estable). */
export const followUpTasksErrorMessages = {
  invalidJsonBody: "Invalid JSON body",
  titleRequired: "title is required",
  titleMustBeString: "title must be a string",
  titleCannotBeEmpty: "title cannot be empty",
  fieldMustBeStringOrNull: (field: string) => `${field} must be a string or null`,
  contactIdInvalid: "contact_id must be a valid UUID or null",
  statusInvalid: "status is not allowed",
  priorityInvalid: "priority is not allowed",
  sourceInvalid: "source is not allowed",
  dateInvalid: (field: string) => `${field} must be a valid ISO date string or null`,
  metadataMustBeObject: "metadata must be a plain JSON object",
  metadataCannotBeArray: "metadata cannot be an array",
  metadataCannotBeString: "metadata cannot be a string",
  failedToLoadTasks: "failed to load follow-up tasks",
  failedToCreateTask: "failed to create follow-up task",
} as const;

export const FOLLOW_UP_TASK_STATUSES = [
  "open",
  "in_progress",
  "completed",
  "cancelled",
  "archived",
] as const;

export type FollowUpTaskStatus = (typeof FOLLOW_UP_TASK_STATUSES)[number];

export const FOLLOW_UP_TASK_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export type FollowUpTaskPriority = (typeof FOLLOW_UP_TASK_PRIORITIES)[number];

export const FOLLOW_UP_TASK_SOURCES = [
  "manual",
  "chat_suggestion",
  "system",
] as const;

export type FollowUpTaskSource = (typeof FOLLOW_UP_TASK_SOURCES)[number];

export type FollowUpTask = {
  id: string;
  contact_id: string | null;
  title: string;
  description: string | null;
  status: FollowUpTaskStatus;
  priority: FollowUpTaskPriority;
  due_at: string | null;
  completed_at: string | null;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateFollowUpTaskInput = {
  title: string;
  contact_id?: string | null;
  description?: string | null;
  status?: FollowUpTaskStatus;
  priority?: FollowUpTaskPriority;
  due_at?: string | null;
  completed_at?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
};

export type PersistenceErrorCode = "not_configured" | "db_error";

export type PersistenceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: PersistenceErrorCode };

export type FollowUpTaskErrorCode =
  | "TITLE_REQUIRED"
  | "TITLE_NOT_STRING"
  | "TITLE_EMPTY"
  | "FIELD_INVALID_TYPE"
  | "CONTACT_ID_INVALID"
  | "STATUS_INVALID"
  | "PRIORITY_INVALID"
  | "SOURCE_INVALID"
  | "DATE_INVALID"
  | "METADATA_INVALID";

export type CreateFollowUpTaskValidationSuccess = {
  ok: true;
  input: CreateFollowUpTaskInput;
};

export type CreateFollowUpTaskValidationFailure = {
  ok: false;
  error: string;
  code?: FollowUpTaskErrorCode;
};

export type CreateFollowUpTaskValidationResult =
  | CreateFollowUpTaskValidationSuccess
  | CreateFollowUpTaskValidationFailure;
