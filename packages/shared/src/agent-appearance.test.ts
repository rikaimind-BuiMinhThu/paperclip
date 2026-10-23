import { describe, expect, it } from "vitest";
import { AGENT_PALETTE_IDS, agentAppearanceSchema, appearanceForPalette, legacyAgentAppearance, randomAgentAppearance, resolveAgentAppearance, agentAvatarUrl } from "./agent-appearance.js";
import { renderAgentSvg } from "./cliplab/static.js";

describe("agent appearance", () => {
  it("assigns only the permanent palettes and defaults to photo-v1", () => {
    for (let i = 0; i < 100; i++) {
      const appearance = randomAgentAppearance();
      expect(AGENT_PALETTE_IDS).toContain(appearance.paletteId);
      expect(appearance.characterVersion).toBe("photo-v1");
    }
    expect(agentAppearanceSchema.safeParse({ schemaVersion: 1, characterVersion: "cap-v1", paletteId: "muted-dream" }).success).toBe(false);
    expect(agentAppearanceSchema.safeParse({ schemaVersion: 1, characterVersion: "photo-v1", paletteId: "deep-tide" }).success).toBe(true);
    expect(agentAppearanceSchema.safeParse({ schemaVersion: 1, characterVersion: "cap-v1", paletteId: "deep-tide" }).success).toBe(true);
  });
  it("preserves a saved appearance and resolves legacy IDs deterministically", () => {
    const appearance = appearanceForPalette("deep-tide");
    expect(appearance.characterVersion).toBe("photo-v1");
    expect(resolveAgentAppearance(appearance, "different-id")).toEqual(appearance);
    expect(resolveAgentAppearance(null, "agent-1")).toEqual(legacyAgentAppearance("agent-1"));
    expect(legacyAgentAppearance("agent-1")).toEqual(legacyAgentAppearance("agent-1"));
    expect(agentAvatarUrl(appearance, 24, 2)).toBe("/api/agent-avatars/photo-v1/deep-tide/rest.png?size=24&scale=2&v=2");
    expect(agentAvatarUrl(appearanceForPalette("deep-tide", "cap-v1"), 24, 2)).toBe("/api/agent-avatars/cap-v1/deep-tide/rest.png?size=24&scale=2&v=2");
  });
  it("renders cap-v1 without a browser and preserves logical-size detail at high density", () => {
    const appearance = appearanceForPalette("bubblegum-sky", "cap-v1");
    // ClipLab v0.2.0 draws an enlarged compact face from 16px; only 12px and
    // below (not a logical size) is body-only.
    const small = renderAgentSvg(appearance, 16, 2);
    expect(small).toContain('width="32"');
    expect(small).toContain('id="agent-face-visible"');
    const eyes = renderAgentSvg(appearance, 24, 2);
    expect(eyes).toContain('width="48"');
    expect(eyes).toContain('id="agent-face-visible"');
    expect(eyes).not.toContain('id="agent-candle-light"');
    expect(renderAgentSvg(appearance, 48, 1)).toContain('id="agent-candle-light"');
    expect(renderAgentSvg(appearance, 24, 2)).toBe(eyes);
  });
});
