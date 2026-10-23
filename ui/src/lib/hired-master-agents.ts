import type { Agent, MasterAgentRecord } from "@paperclipai/shared";

/** Read a master-agent id stored on a company agent after gallery hire. */
export function masterAgentIdFromMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = metadata.masterAgentId;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Master agents already present in the company.
 * Prefers `metadata.masterAgentId`; falls back to title/name match for legacy hires.
 */
export function hiredMasterAgentIds(
  companyAgents: Agent[],
  masterAgents: MasterAgentRecord[],
): Set<string> {
  const hired = new Set<string>();
  const titleToMasterId = new Map<string, string>();
  for (const master of masterAgents) {
    titleToMasterId.set(master.title, master.id);
  }
  for (const agent of companyAgents) {
    const fromMeta = masterAgentIdFromMetadata(agent.metadata);
    if (fromMeta) {
      hired.add(fromMeta);
      continue;
    }
    const byTitle = titleToMasterId.get(agent.title ?? "") ?? titleToMasterId.get(agent.name);
    if (byTitle) hired.add(byTitle);
  }
  return hired;
}
