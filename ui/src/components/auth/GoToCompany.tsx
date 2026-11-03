import { useState, type FormEvent } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/context/TenantContext";
import { useTranslation } from "@/i18n";

/**
 * Apex auth “Go to my company” — resolve slug and navigate to the company host.
 * Hidden unless host tenancy is enabled and the current host is apex.
 */
export function GoToCompany() {
  const { t } = useTranslation();
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
    } catch {
      setError(t("auth.goToCompany.notFound"));
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("auth.goToCompany.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("auth.goToCompany.description")}
        </p>
      </div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">{t("auth.goToCompany.slugLabel")}</span>
          <div className="flex items-center gap-1">
            <input
              className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-ring"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t("auth.goToCompany.slugPlaceholder")}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              required
              autoFocus
            />
            {tenant.rootDomain ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                .{tenant.rootDomain}
              </span>
            ) : null}
          </div>
        </label>
        <Button type="submit" disabled={pending || !slug.trim()}>
          {pending ? t("auth.goToCompany.opening") : t("auth.goToCompany.continue")}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
