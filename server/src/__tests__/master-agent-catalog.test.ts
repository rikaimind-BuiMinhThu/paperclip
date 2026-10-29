import { describe, expect, it } from "vitest";
import { resolveCatalogSkillRef } from "@paperclipai/skills-catalog";
import { MASTER_AGENT_SEEDS, MASTER_TEAM_SEEDS } from "../services/master-agent-catalog.js";

describe("master-agent-catalog marketing skills", () => {
  const marketingAgents = MASTER_AGENT_SEEDS.filter((agent) => agent.department === "marketing");
  const cmo = MASTER_AGENT_SEEDS.find((agent) => agent.slug === "cmo");

  it("assigns skill keys to every marketing agent", () => {
    expect(marketingAgents).toHaveLength(8);
    for (const agent of marketingAgents) {
      expect(agent.skillKeys.length, agent.slug).toBeGreaterThan(0);
    }
  });

  it("uses resolvable shipped catalog skill keys", () => {
    for (const agent of marketingAgents) {
      for (const key of agent.skillKeys) {
        expect(
          resolveCatalogSkillRef(key),
          `${agent.slug} references unknown skill key ${key}`,
        ).not.toBeNull();
      }
    }
  });

  it("requires CMO ask-first intake, content×channel WBS, and dual confirmation", () => {
    expect(cmo).toBeDefined();
    expect(cmo!.description).toMatch(/ask/i);
    expect(cmo!.description).toMatch(/content×channel|WBS|deliverable/i);
    expect(cmo!.instructions).toMatch(/ask_user_questions/);
    expect(cmo!.instructions).toMatch(/Content inventory|content×channel|Package components/i);
    expect(cmo!.instructions).toMatch(/request_confirmation/);
    expect(cmo!.instructions).toMatch(/campaign_deliverables/);
    expect(cmo!.skillKeys).toEqual(
      expect.arrayContaining([
        "paperclipai/bundled/marketing/cmo-campaign-planning",
        "paperclipai/bundled/paperclip-operations/task-planning",
        "paperclipai/optional/marketing/customer-research",
      ]),
    );
  });

  it("lists all marketing agents on the marketing hire team", () => {
    const team = MASTER_TEAM_SEEDS.find((row) => row.slug === "marketing-team");
    expect(team).toBeDefined();
    expect(team!.managerSlug).toBe("cmo");
    expect(team!.memberSlugs).toEqual(marketingAgents.map((agent) => agent.slug));
  });
});
