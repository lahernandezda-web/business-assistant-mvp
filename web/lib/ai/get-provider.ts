import type { AIProvider } from "./types";
import { fakeAIProvider } from "./fake-provider";
import { claudeProvider } from "./claude-provider";

/**
 * Resuelve el proveedor IA según `process.env.AI_PROVIDER`.
 * Valores desconocidos → stub (mismo que vacío) para evitar costes accidentales.
 */
export function getAIProvider(): AIProvider {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (raw === "claude") {
    return claudeProvider;
  }

  // "stub", vacío, indefinido o valor desconocido: stub por seguridad.
  return fakeAIProvider;
}
