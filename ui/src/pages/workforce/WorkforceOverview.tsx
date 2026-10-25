import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, LayoutDashboard, ShieldAlert, Users } from "lucide-react";
import { workforceApi } from "@/api/workforce";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { useCompany } from "@/context/CompanyContext";
import { useTranslation } from "@/i18n";
import { queryKeys } from "@/lib/queryKeys";
import { Link } from "@/lib/router";

export function WorkforceOverview() {
  const { t } = useTranslation();
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
          <h1 className="text-2xl font-semibold">{t("workforce.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("workforce.subtitle")}</p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link to="/agents">{t("workforce.employees")}</Link>
        </Button>
      </div>
      {empty ? (
        <EmptyState
          icon={Users}
          title={t("workforce.emptyTitle")}
          message={t("workforce.emptyMessage")}
          action={t("workforce.createSachi")}
          onAction={() => createTemplate.mutate()}
        />
      ) : null}
      {overview ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard icon={Users} value={overview.totalAgents} label={t("workforce.totalAgents")} to="/agents" />
            <MetricCard icon={Users} value={overview.invokableAgents} label={t("workforce.invokable")} />
            <MetricCard icon={Clock} value={overview.runningShifts} label={t("workforce.runningShifts")} to="/workforce/shifts" />
            <MetricCard icon={ShieldAlert} value={overview.waitingForHumanShifts} label={t("workforce.waitingForHuman")} to="/workforce/approvals" />
            <MetricCard icon={ShieldAlert} value={overview.failedRunsLast7Days} label={t("workforce.failedRuns7d")} />
            <MetricCard icon={LayoutDashboard} value={overview.completedShifts} label={t("workforce.completedShifts")} />
            <MetricCard icon={LayoutDashboard} value={overview.monthSpendCents} label={t("workforce.monthSpendCents")} />
            <MetricCard icon={ShieldAlert} value={overview.pendingApprovals} label={t("workforce.pendingApprovals")} to="/workforce/approvals" />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("workforce.nextRoutine", { title: overview.nextRoutine?.title ?? t("workforce.none") })}
            {overview.nextRoutine?.nextRunAt
              ? ` ${t("workforce.at", { when: new Date(overview.nextRoutine.nextRunAt).toLocaleString() })}`
              : ""}
          </p>
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">{t("workforce.recentShifts")}</h2>
            {overview.recentShifts.length === 0 ? <p className="text-sm text-muted-foreground">{t("workforce.noShiftsYet")}</p> : null}
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
