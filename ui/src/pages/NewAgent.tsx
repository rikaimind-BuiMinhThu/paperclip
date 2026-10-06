import { useEffect } from "react";
import { useTranslation } from "@/i18n";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { NewAgentSetup } from "../components/new-agent/NewAgentSetup";

export function NewAgent() {
  const { t } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  useEffect(() => {
    setBreadcrumbs([
      { label: t("nav.agents"), href: "/agents" },
      { label: t("pages.newAgent.title") },
    ]);
  }, [setBreadcrumbs, t]);
  return <NewAgentSetup />;
}
