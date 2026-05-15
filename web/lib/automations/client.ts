import type {
  AutomationEventPayload,
  AutomationSendResult,
  AutomationServerStatusPayload,
} from "./types";

const AUTOMATIONS_HEADER = "X-Automation-Secret";
const REQUEST_TIMEOUT_MS = 5000;

function isAutomationsEnabled(): boolean {
  return process.env.AUTOMATIONS_ENABLED?.trim() === "true";
}

function getWebhookConfig(): { url: string; secret: string } | null {
  const url = process.env.N8N_WEBHOOK_URL?.trim();
  const secret = process.env.N8N_WEBHOOK_SECRET?.trim();
  if (!url || !secret) {
    return null;
  }
  return { url, secret };
}

/**
 * Estado de configuración de automatizaciones (solo `process.env`).
 * No expone URL, secret ni ningún valor literal de entorno.
 */
export function getAutomationServerStatus(): AutomationServerStatusPayload {
  const enabled = isAutomationsEnabled();
  const has_webhook_url = Boolean(process.env.N8N_WEBHOOK_URL);
  const has_webhook_secret = Boolean(process.env.N8N_WEBHOOK_SECRET);
  const configured = enabled && has_webhook_url && has_webhook_secret;

  return {
    enabled,
    has_webhook_url,
    has_webhook_secret,
    configured,
  };
}

/**
 * Envía un evento de automatización al webhook n8n (solo servidor).
 * No registra secretos ni la URL.
 */
export async function sendAutomationEvent(
  payload: AutomationEventPayload,
): Promise<AutomationSendResult> {
  if (!isAutomationsEnabled()) {
    return { ok: false, error: "disabled" };
  }

  const config = getWebhookConfig();
  if (!config) {
    return { ok: false, error: "not_configured" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(config.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        [AUTOMATIONS_HEADER]: config.secret,
      },
      body: JSON.stringify(payload),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { ok: false, error: "bad_status", status: response.status };
    }

    return { ok: true, status: response.status };
  } catch (err) {
    clearTimeout(timeoutId);

    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "timeout" };
    }

    return { ok: false, error: "network_error" };
  }
}
