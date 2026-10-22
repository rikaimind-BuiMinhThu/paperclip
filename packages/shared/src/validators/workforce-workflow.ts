import { z } from "zod";

export const WORKFORCE_NODE_TYPES = ["start", "employee", "tool", "approval", "artifact", "end"] as const;
export const WORKFORCE_TOOL_NAMES = ["workforce.outbound_message", "workforce.crm_record"] as const;
export const WORKFORCE_MAX_CHAIN_LENGTH = 20;
export const WORKFORCE_MAX_DELEGATION_DEPTH = 3;

const workforceNodeSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.string().trim().min(1),
  agentSource: z.enum(["routine_assignee"]).optional(),
  tool: z.string().trim().min(1).optional(),
  mode: z.enum(["draft", "send"]).optional(),
  bindsNodeId: z.string().trim().min(1).optional(),
  format: z.literal("html").optional(),
}).strict();

const workforceEdgeSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
}).strict();

export const workforceGraphSchema = z.object({
  nodes: z.array(workforceNodeSchema).min(1),
  edges: z.array(workforceEdgeSchema),
}).strict();

export type WorkforceGraph = z.infer<typeof workforceGraphSchema>;
export type WorkforceNode = WorkforceGraph["nodes"][number];

export type WorkforceGraphResult =
  | { ok: true; graph: WorkforceGraph }
  | { ok: false; code: string };

function issue(code: string): WorkforceGraphResult {
  return { ok: false, code };
}

export function validateWorkforceGraph(input: unknown): WorkforceGraphResult {
  const parsed = workforceGraphSchema.safeParse(input);
  if (!parsed.success) return issue("workflow_graph_invalid");
  const graph = parsed.data;
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (ids.has(node.id)) return issue("workflow_graph_invalid");
    ids.add(node.id);
    if (!WORKFORCE_NODE_TYPES.includes(node.type as typeof WORKFORCE_NODE_TYPES[number])) {
      return issue("unsupported_node");
    }
  }
  const starts = graph.nodes.filter((node) => node.type === "start");
  const ends = graph.nodes.filter((node) => node.type === "end");
  if (starts.length !== 1 || ends.length !== 1) return issue("workflow_graph_invalid");

  const outgoing = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) return issue("workflow_graph_invalid");
    const next = outgoing.get(edge.from) ?? [];
    next.push(edge.to);
    outgoing.set(edge.from, next);
  }
  for (const node of graph.nodes) {
    const next = outgoing.get(node.id) ?? [];
    if (node.type === "end") {
      if (next.length > 0) return issue("workflow_graph_invalid");
      continue;
    }
    if (next.length !== 1) return issue("workflow_graph_invalid");
  }

  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  let cursor: WorkforceNode | undefined = starts[0];
  while (cursor) {
    if (seen.has(cursor.id)) return issue("workflow_graph_invalid");
    seen.add(cursor.id);
    if (seen.size > WORKFORCE_MAX_CHAIN_LENGTH) return issue("workflow_graph_invalid");
    const nextId: string | undefined = outgoing.get(cursor.id)?.[0];
    cursor = nextId ? byId.get(nextId) : undefined;
  }
  if (seen.size !== graph.nodes.length) return issue("workflow_graph_invalid");

  for (const node of graph.nodes) {
    if (node.type === "tool") {
      if (!node.tool || !WORKFORCE_TOOL_NAMES.includes(node.tool as typeof WORKFORCE_TOOL_NAMES[number])) {
        return issue("workflow_graph_invalid");
      }
      if (node.tool === "workforce.outbound_message" && node.mode !== "draft" && node.mode !== "send") {
        return issue("workflow_graph_invalid");
      }
      if (node.mode === "send") {
        const bound = node.bindsNodeId ? byId.get(node.bindsNodeId) : undefined;
        if (!bound || bound.type !== "approval") return issue("workflow_graph_invalid");
      }
    }
    if (node.type === "approval") {
      const bound = node.bindsNodeId ? byId.get(node.bindsNodeId) : undefined;
      if (!bound || bound.type !== "tool" || bound.mode !== "draft") return issue("workflow_graph_invalid");
    }
    if (node.type === "employee" && node.agentSource && node.agentSource !== "routine_assignee") {
      return issue("workflow_graph_invalid");
    }
    if (node.type === "artifact" && node.format && node.format !== "html") {
      return issue("unsupported_node");
    }
  }
  return { ok: true, graph };
}

export function nextDelegationDepth(parentRequestDepth: number, maxDepth = WORKFORCE_MAX_DELEGATION_DEPTH) {
  const depth = parentRequestDepth + 1;
  if (depth > maxDepth) return { ok: false as const, code: "delegation_depth_exceeded" };
  return { ok: true as const, depth };
}

export const createWorkforceWorkflowSchema = z.object({
  template: z.literal("sachi-daily").optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  assigneeAgentId: z.string().uuid().optional().nullable(),
  graph: workforceGraphSchema.optional(),
});

export const updateWorkforceDraftSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  assigneeAgentId: z.string().uuid().optional().nullable(),
  nodes: z.array(workforceNodeSchema).min(1),
});

export const startWorkforceRunSchema = z.object({
  issueId: z.string().uuid().optional().nullable(),
  input: z.record(z.string(), z.unknown()).optional(),
});

export type CreateWorkforceWorkflow = z.infer<typeof createWorkforceWorkflowSchema>;
export type UpdateWorkforceDraft = z.infer<typeof updateWorkforceDraftSchema>;
export type StartWorkforceRun = z.infer<typeof startWorkforceRunSchema>;
