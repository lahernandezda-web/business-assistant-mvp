/** Mensajes de error expuestos por `POST /api/contacts` (contrato estable). */
export const contactsErrorMessages = {
  invalidJsonBody: "Invalid JSON body",
  nameRequired: "name is required",
  nameMustBeString: "name must be a string",
  nameCannotBeEmpty: "name cannot be empty",
  fieldMustBeStringOrNull: (field: string) => `${field} must be a string or null`,
  statusInvalid: "status is not allowed",
  contactTypeInvalid: "contact_type is not allowed",
  dateInvalid: (field: string) => `${field} must be a valid ISO date string or null`,
  metadataMustBeObject: "metadata must be a plain JSON object",
  metadataCannotBeArray: "metadata cannot be an array",
  metadataCannotBeString: "metadata cannot be a string",
  failedToLoadContacts: "failed to load contacts",
  failedToCreateContact: "failed to create contact",
} as const;

export const CONTACT_STATUSES = [
  "new",
  "contacted",
  "interested",
  "not_interested",
  "converted",
  "archived",
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_TYPES = [
  "lead",
  "customer",
  "patient",
  "supplier",
  "other",
] as const;

export type ContactType = (typeof CONTACT_TYPES)[number];

export type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: ContactStatus;
  contact_type: ContactType | null;
  interest: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status?: ContactStatus;
  contact_type?: ContactType | null;
  interest?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
  next_follow_up_at?: string | null;
  metadata?: Record<string, unknown>;
};

export type PersistenceErrorCode = "not_configured" | "db_error";

export type PersistenceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: PersistenceErrorCode };

export type ContactErrorCode =
  | "NAME_REQUIRED"
  | "NAME_NOT_STRING"
  | "NAME_EMPTY"
  | "FIELD_INVALID_TYPE"
  | "STATUS_INVALID"
  | "CONTACT_TYPE_INVALID"
  | "DATE_INVALID"
  | "METADATA_INVALID";

export type CreateContactValidationSuccess = {
  ok: true;
  input: CreateContactInput;
};

export type CreateContactValidationFailure = {
  ok: false;
  error: string;
  code?: ContactErrorCode;
};

export type CreateContactValidationResult =
  | CreateContactValidationSuccess
  | CreateContactValidationFailure;
