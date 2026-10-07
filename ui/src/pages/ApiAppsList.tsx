import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AppWindow, Plus } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { apiAppsApi } from "../api/api-apps";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "../components/StatusBadge";

export function ApiAppsList() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setBreadcrumbs([
      { label: "Settings", href: "/company/settings" },
      { label: "API Apps" },
    ]);
  }, [setBreadcrumbs]);

  const { data: apps, isLoading, error } = useQuery({
    queryKey: ["api-apps", selectedCompanyId],
    queryFn: () => apiAppsApi.listApps(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiAppsApi.createApp(selectedCompanyId!, { name: name.trim() }),
    onSuccess: async () => {
      setCreating(false);
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["api-apps", selectedCompanyId] });
    },
  });

  if (!selectedCompanyId) {
    return (
      <EmptyState
        icon={AppWindow}
        title="Select a company"
        description="Choose a company to manage API apps."
      />
    );
  }
  if (isLoading) return <PageSkeleton />;
  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        Failed to load API apps: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">API Apps</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Partner channels. Each app has customers with plans, keys, and custom billable units.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New API app
        </Button>
      </div>

      {creating ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-md border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createMutation.mutate();
          }}
        >
          <div className="min-w-48 flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || createMutation.isPending}>
            Create API app
          </Button>
        </form>
      ) : null}

      {!apps?.length ? (
        <EmptyState
          icon={AppWindow}
          title="No API apps yet"
          description="Create an API app, then add customers with plans and keys."
          action="Create API app"
          onAction={() => setCreating(true)}
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link
                      className="font-medium text-foreground hover:underline"
                      to={`/company/settings/api-apps/${app.id}`}
                    >
                      {app.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={app.status} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {new Date(app.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
