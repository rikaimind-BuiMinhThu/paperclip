import { useTenant } from "@/context/TenantContext";

export function CompanyNotFoundPage() {
  const tenant = useTenant();
  const apex = tenant.origins.apex ?? "/";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Company not found</h1>
      <p className="text-sm text-muted-foreground">
        No company is registered for this subdomain.
      </p>
      <a className="text-sm underline" href={apex}>
        Back to home
      </a>
    </div>
  );
}
