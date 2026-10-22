import { and, desc, eq, inArray, or, type SQL } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { goals, issues, workforceMemories } from "@paperclipai/db";
import { notFound } from "../../errors.js";

export type WorkforceMemoryActor =
  | { type: "agent"; agentId: string }
  | { type: "human"; canReadPrivate: boolean };

export function workforceMemoryService(db: Db) {
  function visible(actor: WorkforceMemoryActor): SQL | undefined {
    if (actor.type === "human" && actor.canReadPrivate) return undefined;
    if (actor.type === "agent") {
      return or(
        eq(workforceMemories.visibility, "company"),
        and(
          eq(workforceMemories.visibility, "agent_private"),
          eq(workforceMemories.ownerAgentId, actor.agentId),
        ),
      );
    }
    return eq(workforceMemories.visibility, "company");
  }

  return {
    async list(companyId: string, actor: WorkforceMemoryActor, filters?: { agentId?: string; scopeType?: string }) {
      const conditions = [
        eq(workforceMemories.companyId, companyId),
        visible(actor),
        filters?.agentId ? eq(workforceMemories.ownerAgentId, filters.agentId) : undefined,
        filters?.scopeType ? eq(workforceMemories.scopeType, filters.scopeType) : undefined,
      ].filter((condition): condition is SQL => condition !== undefined);
      const rows = await db
        .select()
        .from(workforceMemories)
        .where(and(...conditions))
        .orderBy(desc(workforceMemories.createdAt));
      return rows;
    },

    async remove(companyId: string, memoryId: string) {
      const [row] = await db
        .delete(workforceMemories)
        .where(and(eq(workforceMemories.companyId, companyId), eq(workforceMemories.id, memoryId)))
        .returning();
      if (!row) throw notFound("Memory not found");
      return row;
    },

    async contextForNextShift(companyId: string, agentId: string) {
      const goalRows = await db
        .select({ id: goals.id, title: goals.title })
        .from(goals)
        .where(and(
          eq(goals.companyId, companyId),
          eq(goals.ownerAgentId, agentId),
          eq(goals.status, "active"),
        ));
      const openIssueRows = await db
        .select({ id: issues.id, title: issues.title, status: issues.status })
        .from(issues)
        .where(and(
          eq(issues.companyId, companyId),
          eq(issues.assigneeAgentId, agentId),
          inArray(issues.status, ["todo", "in_progress", "blocked"]),
        ));
      const [summary] = await db
        .select({ id: workforceMemories.id, content: workforceMemories.content })
        .from(workforceMemories)
        .where(and(
          eq(workforceMemories.companyId, companyId),
          eq(workforceMemories.ownerAgentId, agentId),
          eq(workforceMemories.kind, "shift_summary"),
          eq(workforceMemories.visibility, "company"),
        ))
        .orderBy(desc(workforceMemories.createdAt))
        .limit(1);
      const privateNotes = await db
        .select({ id: workforceMemories.id, content: workforceMemories.content })
        .from(workforceMemories)
        .where(and(
          eq(workforceMemories.companyId, companyId),
          eq(workforceMemories.ownerAgentId, agentId),
          eq(workforceMemories.visibility, "agent_private"),
        ))
        .orderBy(desc(workforceMemories.createdAt));
      return {
        goals: goalRows,
        openIssues: openIssueRows,
        previousSummary: summary?.content ?? null,
        privateNotes,
      };
    },

    async writeShiftSummary(input: {
      companyId: string;
      agentId: string;
      shiftId: string;
      workflowRunId: string;
      content: string;
    }) {
      const [row] = await db.insert(workforceMemories).values({
        companyId: input.companyId,
        scopeType: "shift",
        scopeId: input.shiftId,
        ownerAgentId: input.agentId,
        visibility: "company",
        kind: "shift_summary",
        content: input.content,
        source: `workflow_run:${input.workflowRunId}`,
      }).returning();
      return row;
    },
  };
}
