import { describe, expect, it } from "vitest";
import type { Agent, MasterAgentRecord } from "@paperclipai/shared";
import { hiredMasterAgentIds, masterAgentIdFromMetadata } from "./hired-master-agents";

describe("hiredMasterAgentIds", () => {
  const masters = [
    { id: "master-1", title: "Chief of Staff" },
    { id: "master-2", title: "CMO" },
  ] as MasterAgentRecord[];

  it("reads masterAgentId from metadata", () => {
    expect(masterAgentIdFromMetadata({ masterAgentId: "master-1" })).toBe("master-1");
    const agents = [
      { id: "a1", name: "Chief of Staff", title: "Chief of Staff", metadata: { masterAgentId: "master-1" } },
    ] as Agent[];
    expect([...hiredMasterAgentIds(agents, masters)]).toEqual(["master-1"]);
  });

  it("falls back to title match for legacy hires", () => {
    const agents = [
      { id: "a2", name: "CMO", title: "CMO", metadata: null },
    ] as Agent[];
    expect([...hiredMasterAgentIds(agents, masters)]).toEqual(["master-2"]);
  });
});
