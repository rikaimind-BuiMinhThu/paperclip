import { useEffect } from "react";
import { useParams } from "@/lib/router";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { advancedTabHref } from "../tool-tabs";
import { ToolsAdminGate } from "./ToolsAdminGate";
import { ProfileDetail } from "./ProfileDetail";
import { t as i18nT } from "@/i18n";

export function ProfileDetailRoute() {
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const params = useParams<{ profileId?: string }>();

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company", href: "/dashboard" },
      { label: i18nT("nav.apps"), href: "/apps" },
      { label: i18nT("nav.accessProfiles"), href: advancedTabHref("profiles") },
      { label: i18nT("nav.profileDetail") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  if (!selectedCompanyId || !params.profileId) {
    return <div className="p-6 text-sm text-muted-foreground">{i18nT("scan.s1211")}</div>;
  }

  return (
    <ToolsAdminGate>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
        <ProfileDetail companyId={selectedCompanyId} profileId={params.profileId} />
      </div>
    </ToolsAdminGate>
  );
}
