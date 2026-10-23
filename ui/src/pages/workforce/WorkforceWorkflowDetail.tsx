import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SACHI_ROUTINE_CRON, SACHI_ROUTINE_TIMEZONE, type WorkforceNode } from "@paperclipai/shared";
import { agentsApi } from "@/api/agents";
import { routinesApi } from "@/api/routines";
import { workforceApi } from "@/api/workforce";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { Link, useParams } from "@/lib/router";

const NODE_TYPES = ["start", "employee", "tool", "approval", "artifact", "end"] as const;

export function WorkforceWorkflowDetail() {
  const { definitionId = "" } = useParams<{ definitionId: string }>();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: queryKeys.workforce.workflow(selectedCompanyId ?? "none", definitionId),
    queryFn: () => workforceApi.getWorkflow(selectedCompanyId!, definitionId),
    enabled: Boolean(selectedCompanyId && definitionId),
  });
  const agents = useQuery({
    queryKey: ["agents", selectedCompanyId],
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });
  const draft = detail.data?.versions.find((version) => version.state === "draft") ?? detail.data?.versions[0];
  const [nodes, setNodes] = useState<WorkforceNode[] | null>(null);
  const [assigneeAgentId, setAssigneeAgentId] = useState("");
  const currentNodes = nodes ?? draft?.graph.nodes ?? [];

  const save = useMutation({
    mutationFn: () => workforceApi.saveDraft(selectedCompanyId!, definitionId, currentNodes),
    onSuccess: async () => {
      if (!selectedCompanyId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.workforce.workflow(selectedCompanyId, definitionId) });
    },
  });
  const publish = useMutation({
    mutationFn: () => workforceApi.publish(selectedCompanyId!, definitionId),
    onSuccess: async () => {
      if (!selectedCompanyId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.workforce.workflow(selectedCompanyId, definitionId) });
    },
  });
  const createRoutine = useMutation({
    mutationFn: async () => {
      const routine = await routinesApi.create(selectedCompanyId!, {
        title: detail.data?.definition.name ?? "Daily workflow",
        assigneeAgentId: assigneeAgentId || detail.data?.definition.assigneeAgentId,
        workflowDefinitionId: definitionId,
        concurrencyPolicy: "skip_if_active",
      });
      await routinesApi.createTrigger(routine.id, {
        kind: "schedule",
        cronExpression: SACHI_ROUTINE_CRON,
        timezone: SACHI_ROUTINE_TIMEZONE,
        label: "Weekday morning",
      });
      return routine;
    },
  });

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{detail.data?.definition.name ?? "Workflow"}</h1>
      <p className="text-sm text-muted-foreground">
        Suggested schedule {SACHI_ROUTINE_CRON} {SACHI_ROUTINE_TIMEZONE}. Apply it on the routine form, or create the routine here.
      </p>
      <div className="flex flex-col gap-2">
        {currentNodes.map((node, index) => (
          <label key={node.id} className="flex items-center gap-3 text-sm">
            <span className="w-24">{node.id}</span>
            <select
              className="rounded-md border bg-background px-2 py-1"
              value={node.type}
              onChange={(event) => {
                const next = currentNodes.map((item, itemIndex) => (
                  itemIndex === index ? { ...item, type: event.target.value } : item
                ));
                setNodes(next);
              }}
            >
              {NODE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" disabled={save.isPending} onClick={() => save.mutate()}>
          Save draft
        </Button>
        <Button type="button" disabled={publish.isPending || !detail.data?.definition.currentDraftVersionId} onClick={() => publish.mutate()}>
          Publish
        </Button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <select
          className="rounded-md border bg-background px-2 py-1 text-sm"
          value={assigneeAgentId}
          onChange={(event) => setAssigneeAgentId(event.target.value)}
        >
          <option value="">Select employee</option>
          {(agents.data ?? []).map((agent) => (
            <option key={agent.id} value={agent.id}>{agent.name}</option>
          ))}
        </select>
        <Button type="button" variant="secondary" disabled={createRoutine.isPending} onClick={() => createRoutine.mutate()}>
          Create weekday routine
        </Button>
      </div>
      {createRoutine.data ? <p className="text-sm">Routine created. Open Routines to confirm the schedule.</p> : null}
      <h2 className="text-lg font-medium">Runs</h2>
      {(detail.data?.runs ?? []).map((run) => (
        <Link key={run.id} to={`/workforce/runs/${run.id}`} className="text-sm underline">
          {run.status} · {new Date(run.startedAt).toLocaleString()}
        </Link>
      ))}
    </div>
  );
}
