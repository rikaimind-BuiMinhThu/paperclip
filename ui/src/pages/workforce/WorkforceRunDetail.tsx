import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workforceApi } from "@/api/workforce";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { Link, useParams } from "@/lib/router";

export function WorkforceRunDetail() {
  const { runId = "" } = useParams<{ runId: string }>();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: queryKeys.workforce.run(selectedCompanyId ?? "none", runId),
    queryFn: () => workforceApi.getRun(selectedCompanyId!, runId),
    enabled: Boolean(selectedCompanyId && runId),
  });
  const cancel = useMutation({
    mutationFn: () => workforceApi.cancelRun(selectedCompanyId!, runId),
    onSuccess: async () => {
      if (!selectedCompanyId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.workforce.run(selectedCompanyId, runId) });
    },
  });
  const run = detail.data?.run;
  const steps = detail.data?.steps ?? [];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Run {run?.status ?? ""}</h1>
        <Button type="button" variant="outline" disabled={cancel.isPending || run?.status === "completed"} onClick={() => cancel.mutate()}>
          Cancel
        </Button>
      </div>
      {run?.issueId ? <Link to={`/issues/${run.issueId}`} className="text-sm underline">Open issue</Link> : null}
      {run?.errorCode ? <p className="text-sm text-destructive">{run.errorCode}</p> : null}
      <ol className="flex flex-col gap-3">
        {steps.map((step) => {
          const payload = step.output.payload as { subject?: string; to?: string; body?: string } | undefined;
          const contentPath = typeof step.output.contentPath === "string" ? step.output.contentPath : null;
          return (
            <li key={step.id} className="rounded-lg border p-4">
              <p className="font-medium">{step.nodeId} · {step.status}</p>
              {payload?.subject ? <p className="text-sm">Subject: {payload.subject}</p> : null}
              {contentPath ? (
                <div className="mt-3 flex flex-col gap-2">
                  <a className="text-sm underline" href={contentPath}>Open artifact</a>
                  <iframe title="Shift report" sandbox="" src={contentPath} className="h-40 w-full rounded-md border" />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
