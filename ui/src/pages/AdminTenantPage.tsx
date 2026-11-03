import { useQuery } from "@tanstack/react-query";
import { companiesApi } from "@/api/companies";
import { queryKeys } from "@/lib/queryKeys";
import { PaperclipLoading } from "@/components/AnimatedPaperclipIcon";
import { useTenant } from "@/context/TenantContext";

/**
 * Platform-admin host (`admin.{rootDomain}`): list companies and open each
 * company origin. Sessions are per-host — navigation opens the company
 * subdomain where the admin signs in separately.
 */
export function AdminTenantPage() {
  const tenant = useTenant();
  const companiesQuery = useQuery({
    queryKey: queryKeys.companies.list(null),
    queryFn: () => companiesApi.list(),
  });

  if (companiesQuery.isLoading) return <PaperclipLoading />;

  const companies = companiesQuery.data ?? [];
  const root = tenant.rootDomain;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Platform admin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Open a company subdomain. Sign-in is separate on each host.
      </p>
      <ul className="mt-8 divide-y divide-border rounded-lg border border-border">
        {companies.map((company) => {
          const origin =
            root && company.slug
              ? `${window.location.protocol}//${company.slug}.${root}`
              : null;
          return (
            <li key={company.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <div className="font-medium">{company.name}</div>
                <div className="text-xs text-muted-foreground">
                  {company.slug ?? company.issuePrefix}
                </div>
              </div>
              {origin ? (
                <a className="text-sm underline" href={`${origin}/dashboard`}>
                  Open
                </a>
              ) : (
                <span className="text-xs text-muted-foreground">No host origin</span>
              )}
            </li>
          );
        })}
        {companies.length === 0 ? (
          <li className="px-4 py-6 text-sm text-muted-foreground">No companies yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
