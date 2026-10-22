import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentPaletteId } from "./agent-appearance.js";

/** Absolute path to the bundled photo-v1 headshot for a palette slot. */
export function agentPortraitPath(paletteId: AgentPaletteId): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "assets", "agent-portraits", "photo-v1", `${paletteId}.png`),
    join(here, "assets", "agent-portraits", "photo-v1", `${paletteId}.png`),
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  throw new Error(`Missing photo-v1 portrait for palette "${paletteId}"`);
}
