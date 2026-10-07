import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { apiAppsApi } from "../api/api-apps";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/utils";

export function ApiAppDetail() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [unitForm, setUnitForm] = useState(false);
  const [unitKey, setUnitKey] = useState("pdf_page");
  const [unitName, setUnitName] = useState("Process PDF");
  const [packSize, setPackSize] = useState(1);
  const [defaultPrice, setDefaultPrice] = useState(2);
  const [customerForm, setCustomerForm] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [planId, setPlanId] = useState("");

  const { data: app, isLoading } = useQuery({
    queryKey: ["api-app", appId],
    queryFn: () => apiAppsApi.getApp(appId!),
    enabled: Boolean(appId),
  });
  const { data: summary } = useQuery({
    queryKey: ["api-app-summary", appId],
    queryFn: () => apiAppsApi.usageSummary(appId!),
    enabled: Boolean(appId),
  });
  const { data: units } = useQuery({
    queryKey: ["api-app-units", appId],
    queryFn: () => apiAppsApi.listBillingUnits(appId!),
    enabled: Boolean(appId),
  });
  const { data: customers } = useQuery({
    queryKey: ["api-app-customers", appId],
    queryFn: () => apiAppsApi.listCustomers(appId!),
    enabled: Boolean(appId),
  });
  const { data: plans } = useQuery({
    queryKey: ["pricing-plans"],
    queryFn: () => apiAppsApi.listPlans(),
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Settings", href: "/company/settings" },
      { label: "API Apps", href: "/company/settings/api-apps" },
      { label: app?.name ?? "App" },
    ]);
  }, [setBreadcrumbs, app?.name]);

  useEffect(() => {
    if (!planId && plans?.[0]?.id) setPlanId(plans[0].id);
  }, [plans, planId]);

  const pauseMutation = useMutation({
    mutationFn: (status: "active" | "paused") => apiAppsApi.updateApp(appId!, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-app", appId] }),
  });

  const createUnit = useMutation({
    mutationFn: () =>
      apiAppsApi.createBillingUnit(appId!, {
        unitKey: unitKey.trim(),
        displayName: unitName.trim(),
        aggregation: packSize > 1 ? "per_pack" : "per_unit",
        packSize,
        defaultPriceCents: defaultPrice,
      }),
    onSuccess: async () => {
      setUnitForm(false);
      await queryClient.invalidateQueries({ queryKey: ["api-app-units", appId] });
    },
  });

  const createCustomer = useMutation({
    mutationFn: () =>
      apiAppsApi.createCustomer(appId!, {
        name: customerName.trim(),
        planId,
      }),
    onSuccess: async (customer) => {
      setCustomerForm(false);
      setCustomerName("");
      await queryClient.invalidateQueries({ queryKey: ["api-app-customers", appId] });
      navigate(`/company/settings/api-apps/${appId}/customers/${customer.id}?mint=1`);
    },
  });

  if (isLoading || !app) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{app.name}</h1>
            <StatusBadge status={app.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary
              ? `${summary.customerCount} customers · ${summary.nearingLimitCount} nearing limit · ${summary.blockedCount} blocked`
              : "Loading usage summary…"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            pauseMutation.mutate(app.status === "active" ? "paused" : "active")
          }
        >
          {app.status === "active" ? "Pause app" : "Resume app"}
        </Button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Billing units</h2>
          <Button size="sm" variant="outline" onClick={() => setUnitForm(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add unit
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Customers inherit these defaults. Override price per customer on the customer page.
        </p>
        {unitForm ? (
          <form
            className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              createUnit.mutate();
            }}
          >
            <Input placeholder="unit_key" value={unitKey} onChange={(e) => setUnitKey(e.target.value)} />
            <Input placeholder="Display name" value={unitName} onChange={(e) => setUnitName(e.target.value)} />
            <Input
              type="number"
              min={1}
              value={packSize}
              onChange={(e) => setPackSize(Number(e.target.value) || 1)}
              placeholder="Pack size"
            />
            <Input
              type="number"
              min={0}
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(Number(e.target.value) || 0)}
              placeholder="Default price cents"
            />
            <div className="flex gap-2 sm:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setUnitForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createUnit.isPending}>
                Save unit
              </Button>
            </div>
          </form>
        ) : null}
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Billing</th>
                <th className="px-3 py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {(units ?? []).map((unit) => (
                <tr key={unit.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{unit.unitKey}</td>
                  <td className="px-3 py-2">{unit.displayName}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatCents(unit.defaultPriceCents)} per {unit.packSize}{" "}
                    {unit.packSize === 1 ? "unit" : "pack"}
                  </td>
                  <td className="px-3 py-2">{unit.isActive ? "Yes" : "No"}</td>
                </tr>
              ))}
              {!units?.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                    No units yet. Add pdf_page or qa_question to start metering.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Customers</h2>
          <Button size="sm" onClick={() => setCustomerForm(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add customer
          </Button>
        </div>
        {customerForm ? (
          <form
            className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (customerName.trim() && planId) createCustomer.mutate();
            }}
          >
            <div className="min-w-40 flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="min-w-40 space-y-1">
              <label className="text-xs text-muted-foreground">Plan</label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
              >
                {(plans ?? []).map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.displayName}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" variant="ghost" onClick={() => setCustomerForm(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createCustomer.isPending}>
              Create customer
            </Button>
          </form>
        ) : null}
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">External ref</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Plan</th>
              </tr>
            </thead>
            <tbody>
              {(customers ?? []).map((customer) => {
                const plan = plans?.find((p) => p.id === customer.planId);
                return (
                  <tr key={customer.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Link
                        className="font-medium hover:underline"
                        to={`/company/settings/api-apps/${appId}/customers/${customer.id}`}
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {customer.externalRef ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={customer.status} />
                    </td>
                    <td className="px-3 py-2">{plan?.displayName ?? customer.planId.slice(0, 8)}</td>
                  </tr>
                );
              })}
              {!customers?.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                    Add a customer to assign a plan and mint a key.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
