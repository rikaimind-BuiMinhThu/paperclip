import { useState, type FormEvent } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/context/TenantContext";

/**
 * Apex "Go to my company" — resolve slug and navigate to the company host.
 */
export function GoToCompany() {
  const tenant = useTenant();
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!tenant.hostTenancyEnabled || tenant.kind !== "apex") {
    return null;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await api.get<{
        origin: string;
        authUrl: string;
        boardUrl: string;
      }>(`/tenant/resolve?slug=${encodeURIComponent(slug.trim())}`);
      window.location.assign(result.authUrl || result.boardUrl || result.origin);
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Company not found";
      setError(message);
      setPending(false);
    }
  }

  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6">
        <h2 className="text-xl font-semibold tracking-tight">Go to my company</h2>
        <p className="text-sm text-muted-foreground">
          Enter your company subdomain to open the board.
        </p>
        <form className="flex max-w-md flex-wrap items-end gap-3" onSubmit={onSubmit}>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Company slug</span>
            <div className="flex items-center gap-1">
              <input
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                required
              />
              {tenant.rootDomain ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  .{tenant.rootDomain}
                </span>
              ) : null}
            </div>
          </label>
          <Button type="submit" disabled={pending || !slug.trim()}>
            {pending ? "Opening…" : "Continue"}
          </Button>
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </section>
  );
}
