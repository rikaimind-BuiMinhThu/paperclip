import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, LayoutDashboard, ShieldAlert, Users } from "lucide-react";
import { workforceApi } from "@/api/workforce";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { Link } from "@/lib/router";

export function WorkforceOverview() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const overviewQuery = useQuery({
    queryKey: queryKeys.workforce.overview(selectedCompanyId ?? "none"),
    queryFn: () => workforceApi.overview(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });
  const createTemplate = useMutation({
    mutationFn: () => workforceApi.createWorkflow(selectedCompanyId!, { template: "sachi-daily" }),
    onSuccess: async () => {
      if (!selectedCompanyId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.workforce.overview(selectedCompanyId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.workforce.workflows(selectedCompanyId) });
    },
  });
  const overview = overviewQuery.data;
  const empty = overview && overview.totalAgents === 0 && overview.workflowCount === 0;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Workforce</h1>
          <p className="text-sm text-muted-foreground">AI employees, shifts, and approvals.</p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to="/agents">Employees</Link>
        </Button>
      </div>
      {empty ? (
        <EmptyState
          icon={Users}
          title="No AI employees yet"
          message="Hire an employee, then start the daily sales workflow."
          action="Create Sachi workflow"
          onAction={() => createTemplate.mutate()}
        />
      ) : null}
      {overview ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard icon={Users} value={overview.totalAgents} label="Total agents" to="/agents" />
            <MetricCard icon={Users} value={overview.invokableAgents} label="Invokable" />
            <MetricCard icon={Clock} value={overview.runningShifts} label="Running shifts" to="/workforce/shifts" />
            <MetricCard icon={ShieldAlert} value={overview.waitingForHumanShifts} label="Waiting for human" to="/workforce/approvals" />
            <MetricCard icon={ShieldAlert} value={overview.failedRunsLast7Days} label="Failed runs, 7 days" />
            <MetricCard icon={LayoutDashboard} value={overview.completedShifts} label="Completed shifts" />
            <MetricCard icon={LayoutDashboard} value={overview.monthSpendCents} label="Month spend, cents" />
            <MetricCard icon={ShieldAlert} value={overview.pendingApprovals} label="Pending approvals" to="/workforce/approvals" />
          </div>
          <p className="text-sm text-muted-foreground">
            Next routine: {overview.nextRoutine?.title ?? "none"}
            {overview.nextRoutine?.nextRunAt ? ` at ${new Date(overview.nextRoutine.nextRunAt).toLocaleString()}` : ""}
          </p>
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Recent shifts</h2>
            {overview.recentShifts.length === 0 ? <p className="text-sm text-muted-foreground">No shifts yet.</p> : null}
            {overview.recentShifts.map((shift) => (
              <Link key={shift.id} to={`/workforce/shifts/${shift.id}`} className="text-sm underline">
                {shift.status} · {new Date(shift.startedAt).toLocaleString()}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
