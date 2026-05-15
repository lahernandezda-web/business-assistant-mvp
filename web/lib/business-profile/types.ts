/** Mensajes de error expuestos por `POST /api/business-profile` (contrato estable). */
export const businessProfileErrorMessages = {
  invalidJsonBody: "Invalid JSON body",
  nameRequired: "name is required",
  nameMustBeString: "name must be a string",
  nameCannotBeEmpty: "name cannot be empty",
  fieldMustBeStringOrNull: (field: string) => `${field} must be a string or null`,
  metadataMustBeObject: "metadata must be a plain JSON object",
  metadataCannotBeArray: "metadata cannot be an array",
  metadataCannotBeString: "metadata cannot be a string",
  failedToLoadProfile: "failed to load business profile",
  failedToCreateProfile: "failed to create business profile",
} as const;

export type BusinessProfile = {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  target_customer: string | null;
  tone: string | null;
  services: string | null;
  location: string | null;
  website: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type CreateBusinessProfileInput = {
  name: string;
  industry?: string | null;
  description?: string | null;
  target_customer?: string | null;
  tone?: string | null;
  services?: string | null;
  location?: string | null;
  website?: string | null;
  metadata?: Record<string, unknown>;
};

export type PersistenceErrorCode = "not_configured" | "db_error";

export type PersistenceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: PersistenceErrorCode };

export type BusinessProfileErrorCode =
  | "NAME_REQUIRED"
  | "NAME_NOT_STRING"
  | "NAME_EMPTY"
  | "FIELD_INVALID_TYPE"
  | "METADATA_INVALID";

export type CreateBusinessProfileValidationSuccess = {
  ok: true;
  input: CreateBusinessProfileInput;
};

export type CreateBusinessProfileValidationFailure = {
  ok: false;
  error: string;
  code?: BusinessProfileErrorCode;
};

export type CreateBusinessProfileValidationResult =
  | CreateBusinessProfileValidationSuccess
  | CreateBusinessProfileValidationFailure;
