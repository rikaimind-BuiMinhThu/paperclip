import { describe, expect, it } from "vitest";
import { resolveCatalogSkillRef } from "@paperclipai/skills-catalog";
import { MASTER_AGENT_SEEDS, MASTER_TEAM_SEEDS } from "../services/master-agent-catalog.js";

describe("master-agent-catalog marketing skills", () => {
  const marketingAgents = MASTER_AGENT_SEEDS.filter((agent) => agent.department === "marketing");

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

  it("lists all marketing agents on the marketing hire team", () => {
    const team = MASTER_TEAM_SEEDS.find((row) => row.slug === "marketing-team");
    expect(team).toBeDefined();
    expect(team!.managerSlug).toBe("cmo");
    expect(team!.memberSlugs).toEqual(marketingAgents.map((agent) => agent.slug));
  });
});
