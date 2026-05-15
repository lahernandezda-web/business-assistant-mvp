import type { BusinessProfile } from "./types";

function hasValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Convierte un Business Profile en un bloque de texto compacto para el modelo.
 * Solo incluye campos con valor; devuelve null si no hay nada que incluir.
 */
export function formatBusinessProfileContext(
  profile: BusinessProfile,
): string | null {
  const lines: string[] = [];

  if (hasValue(profile.name)) {
    lines.push(`- Name: ${profile.name.trim()}`);
  }
  if (hasValue(profile.industry)) {
    lines.push(`- Industry: ${profile.industry.trim()}`);
  }
  if (hasValue(profile.description)) {
    lines.push(`- Description: ${profile.description.trim()}`);
  }
  if (hasValue(profile.target_customer)) {
    lines.push(`- Target customer: ${profile.target_customer.trim()}`);
  }
  if (hasValue(profile.tone)) {
    lines.push(`- Tone: ${profile.tone.trim()}`);
  }
  if (hasValue(profile.services)) {
    lines.push(`- Services: ${profile.services.trim()}`);
  }
  if (hasValue(profile.location)) {
    lines.push(`- Location: ${profile.location.trim()}`);
  }
  if (hasValue(profile.website)) {
    lines.push(`- Website: ${profile.website.trim()}`);
  }

  if (lines.length === 0) {
    return null;
  }

  return `Business context:\n${lines.join("\n")}`;
}
