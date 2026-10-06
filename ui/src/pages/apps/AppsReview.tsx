import { useEffect } from "react";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { useTranslation } from "@/i18n";
import { ReviewQueueCard } from "./ReviewQueueCard";

/**
 * Review — the "decisions waiting on you" inbox (PAP-12371, Finding B).
 *
 * Ask-first approvals used to live only inside the "Needs attention" page,
 * folded together with health/error triage. That buried the one thing a user
 * must act on for their agents to proceed. This is the explicit, top-level
 * home for those approvals, aligned with the Inbox "waiting for your OK"
 * language from the approved PAP-11178 gateway UX. Health issues stay on
 * "Needs attention"; decisions live here.
 */
export function AppsReview() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([
      { label: t("apps.title"), href: "/apps" },
      { label: t("pages.appsReview.title") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, t]);

  if (!selectedCompanyId) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("pages.appsReview.selectOrganization")}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("pages.appsReview.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("pages.appsReview.description")}</p>
      </header>

      <ReviewQueueCard emptyState="reassure" heading={t("pages.appsReview.waitingForOk")} />
    </div>
  );
}
