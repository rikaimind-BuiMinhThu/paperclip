import { useQuery } from "@tanstack/react-query";
import { workforceApi } from "@/api/workforce";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { Link } from "@/lib/router";

export function WorkforceWorkflows() {
  const { selectedCompanyId } = useCompany();
  const workflows = useQuery({
    queryKey: queryKeys.workforce.workflows(selectedCompanyId ?? "none"),
    queryFn: () => workforceApi.listWorkflows(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Workflows</h1>
      {(workflows.data ?? []).map((item) => (
        <Link key={item.definition.id} to={`/workforce/workflows/${item.definition.id}`} className="flex items-center justify-between rounded-lg border p-4">
          <span className="font-medium">{item.definition.name}</span>
          <span className="text-sm text-muted-foreground">
            {item.definition.status}
            {item.publishedVersionNumber != null ? ` · v${item.publishedVersionNumber}` : ""}
          </span>
        </Link>
      ))}
      {workflows.data && workflows.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No workflows yet. Create one from Workforce.</p>
      ) : null}
    </div>
  );
}
