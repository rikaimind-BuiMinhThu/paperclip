import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { Copy, Plus } from "lucide-react";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { apiAppsApi } from "../api/api-apps";
import { UsageMeters } from "../components/api-apps/UsageMeters";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { copyTextToClipboard } from "@/lib/clipboard";
import { formatCents } from "@/lib/utils";

export function ApiAppCustomerDetail() {
  const { appId, customerId } = useParams<{ appId: string; customerId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [mintOpen, setMintOpen] = useState(searchParams.get("mint") === "1");
  const [keyName, setKeyName] = useState("Production");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [priceDrafts, setPriceDrafts] = useState<
    Record<string, { priceCents: number; enabled: boolean; monthlyUnitCap: string }>
  >({});

  const { data: app } = useQuery({
    queryKey: ["api-app", appId],
    queryFn: () => apiAppsApi.getApp(appId!),
    enabled: Boolean(appId),
  });
  const { data: customer, isLoading } = useQuery({
    queryKey: ["api-app-customer", customerId],
    queryFn: () => apiAppsApi.getCustomer(customerId!),
    enabled: Boolean(customerId),
  });
  const { data: usage } = useQuery({
    queryKey: ["api-app-customer-usage", customerId],
    queryFn: () => apiAppsApi.usage(customerId!),
    enabled: Boolean(customerId),
  });
  const { data: keys } = useQuery({
    queryKey: ["api-app-customer-keys", customerId],
    queryFn: () => apiAppsApi.listKeys(customerId!),
    enabled: Boolean(customerId),
  });
  const { data: unitPrices } = useQuery({
    queryKey: ["api-app-customer-unit-prices", customerId],
    queryFn: () => apiAppsApi.getUnitPrices(customerId!),
    enabled: Boolean(customerId),
  });
  const { data: plans } = useQuery({
    queryKey: ["pricing-plans"],
    queryFn: () => apiAppsApi.listPlans(),
  });
  const { data: meterEvents } = useQuery({
    queryKey: ["api-app-customer-meters", customerId],
    queryFn: () => apiAppsApi.meterEvents(customerId!),
    enabled: Boolean(customerId),
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: "Settings", href: "/company/settings" },
      { label: "API Apps", href: "/company/settings/api-apps" },
      { label: app?.name ?? "App", href: `/company/settings/api-apps/${appId}` },
      { label: customer?.name ?? "Customer" },
    ]);
  }, [setBreadcrumbs, app?.name, appId, customer?.name]);

  useEffect(() => {
    if (!unitPrices) return;
    const next: typeof priceDrafts = {};
    for (const row of unitPrices) {
      next[row.billingUnitDefId] = {
        priceCents: row.priceCents,
        enabled: row.enabled,
        monthlyUnitCap: row.monthlyUnitCap != null ? String(row.monthlyUnitCap) : "",
      };
    }
    setPriceDrafts(next);
  }, [unitPrices]);

  useEffect(() => {
    if (searchParams.get("mint") === "1") {
      setMintOpen(true);
      searchParams.delete("mint");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const mintMutation = useMutation({
    mutationFn: () => apiAppsApi.createKey(customerId!, { name: keyName.trim() || "default" }),
    onSuccess: async (created) => {
      setCreatedToken(created.token);
      pushToast({
        title: "API key created",
        body: "Copy it now. You will not see this key again.",
        tone: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["api-app-customer-keys", customerId] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (keyId: string) => apiAppsApi.revokeKey(customerId!, keyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-app-customer-keys", customerId] }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: "active" | "paused") =>
      apiAppsApi.updateCustomer(customerId!, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-app-customer", customerId] }),
  });

  const planMutation = useMutation({
    mutationFn: (nextPlanId: string) =>
      apiAppsApi.updateCustomer(customerId!, { planId: nextPlanId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-app-customer", customerId] });
      queryClient.invalidateQueries({ queryKey: ["api-app-customer-usage", customerId] });
    },
  });

  const savePrices = useMutation({
    mutationFn: () =>
      apiAppsApi.putUnitPrices(
        customerId!,
        Object.entries(priceDrafts).map(([billingUnitDefId, draft]) => ({
          billingUnitDefId,
          priceCents: draft.priceCents,
          enabled: draft.enabled,
          monthlyUnitCap: draft.monthlyUnitCap.trim()
            ? Number(draft.monthlyUnitCap)
            : null,
        })),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["api-app-customer-unit-prices", customerId] }),
  });

  if (isLoading || !customer) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{customer.name}</h1>
            <StatusBadge status={customer.status} />
            {usage?.blocked ? <StatusBadge status="cancelled" label="Over plan" /> : null}
          </div>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {customer.externalRef ?? "No external ref"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            statusMutation.mutate(customer.status === "active" ? "paused" : "active")
          }
        >
          {customer.status === "active" ? "Pause" : "Resume"}
        </Button>
      </div>

      {usage?.llmBlocked || usage?.unitBlocked ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {usage.unitBlocked
            ? "This customer is over their unit spend cap. API calls return 402 until you raise the cap or the month resets."
            : "This customer is over their plan limit. API calls return 402 until you upgrade or the month resets."}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Overview</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Plan</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={customer.planId}
              onChange={(e) => planMutation.mutate(e.target.value)}
            >
              {(plans ?? []).map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.displayName} ({formatCents(plan.monthlyCostCentsLimit)} / mo)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Email</label>
            <div className="text-sm">{customer.email ?? "—"}</div>
          </div>
        </div>
      </section>

      {usage ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Usage (this month)</h2>
          <UsageMeters
            tokensUsed={usage.tokensUsed}
            tokenLimit={usage.tokenLimit}
            costCentsUsed={usage.costCentsUsed}
            costCentsLimit={usage.costCentsLimit}
            unitSpendCentsUsed={usage.unitSpendCentsUsed}
            unitSpendCapCents={usage.unitSpendCapCents}
            warnToken={usage.warnToken}
            warnCost={usage.warnCost}
            llmBlocked={usage.llmBlocked}
            unitBlocked={usage.unitBlocked}
          />
          {usage.units.length ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {usage.units.map((unit) => (
                <li key={unit.unitKey}>
                  {unit.displayName}: {unit.quantity} qty · {formatCents(unit.costCents)}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Unit prices</h2>
          <Button
            size="sm"
            variant="outline"
            disabled={savePrices.isPending || !unitPrices?.length}
            onClick={() => savePrices.mutate()}
          >
            Save prices
          </Button>
        </div>
        {!unitPrices?.length ? (
          <p className="text-sm text-muted-foreground">
            Define units on the app first.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Unit</th>
                  <th className="px-3 py-2">Price (¢)</th>
                  <th className="px-3 py-2">Enabled</th>
                  <th className="px-3 py-2">Monthly qty cap</th>
                </tr>
              </thead>
              <tbody>
                {unitPrices.map((row) => {
                  const draft = priceDrafts[row.billingUnitDefId];
                  return (
                    <tr key={row.billingUnitDefId} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div>{row.displayName}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {row.unitKey} · pack {row.packSize}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-24"
                          value={draft?.priceCents ?? row.priceCents}
                          onChange={(e) =>
                            setPriceDrafts((prev) => ({
                              ...prev,
                              [row.billingUnitDefId]: {
                                ...prev[row.billingUnitDefId]!,
                                priceCents: Number(e.target.value) || 0,
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={draft?.enabled ?? row.enabled}
                          onChange={(e) =>
                            setPriceDrafts((prev) => ({
                              ...prev,
                              [row.billingUnitDefId]: {
                                ...prev[row.billingUnitDefId]!,
                                enabled: e.target.checked,
                              },
                            }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          className="h-8 w-28"
                          value={draft?.monthlyUnitCap ?? ""}
                          placeholder="—"
                          onChange={(e) =>
                            setPriceDrafts((prev) => ({
                              ...prev,
                              [row.billingUnitDefId]: {
                                ...prev[row.billingUnitDefId]!,
                                monthlyUnitCap: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">API keys</h2>
          <Button
            size="sm"
            onClick={() => {
              setCreatedToken(null);
              setMintOpen(true);
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Create key
          </Button>
        </div>
        {mintOpen ? (
          <div className="space-y-3 rounded-md border border-border p-3">
            {createdToken ? (
              <>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Copy now. You will not see this key again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-muted px-2 py-1 font-mono text-xs">
                    {createdToken}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await copyTextToClipboard(createdToken);
                      pushToast({ title: "Copied", tone: "success" });
                    }}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <Button size="sm" onClick={() => setMintOpen(false)}>
                  Done
                </Button>
              </>
            ) : (
              <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  mintMutation.mutate();
                }}
              >
                <div className="min-w-40 flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Name</label>
                  <Input value={keyName} onChange={(e) => setKeyName(e.target.value)} />
                </div>
                <Button type="button" variant="ghost" onClick={() => setMintOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={mintMutation.isPending}>
                  Create key
                </Button>
              </form>
            )}
          </div>
        ) : null}
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last used</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(keys ?? []).map((key) => (
                <tr key={key.id} className="border-t border-border">
                  <td className="px-3 py-2">{key.name}</td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      status={key.revokedAt ? "cancelled" : "active"}
                      label={key.revokedAt ? "Revoked" : "Active"}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!key.revokedAt ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Revoke key ${key.name}?`)) {
                            revokeMutation.mutate(key.id);
                          }
                        }}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!keys?.length ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                    No keys yet. Create a key to share with your partner.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Recent meter events</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {(meterEvents ?? []).slice(0, 10).map((event) => (
            <li key={String(event.id)} className="font-mono text-xs">
              {String(event.unitKey)} · qty {String(event.quantity)} ·{" "}
              {formatCents(Number(event.costCents ?? 0))} · {String(event.source)}
            </li>
          ))}
          {!meterEvents?.length ? <li>No meter events yet.</li> : null}
        </ul>
      </section>

      <details className="rounded-md border border-border p-3 text-sm">
        <summary className="cursor-pointer font-medium">Partner quickstart</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">{`POST /api/companies/{companyId}/issues
Authorization: Bearer pcp_cust_YOUR_KEY
Content-Type: application/json

{ "title": "Example task", "description": "…", "status": "todo" }

POST /api/api-app-customers/me/meter
Authorization: Bearer pcp_cust_YOUR_KEY
Idempotency-Key: unique-id

{ "unitKey": "pdf_page", "quantity": 12 }`}</pre>
      </details>
    </div>
  );
}
