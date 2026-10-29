import { PageTabBar } from "@/components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { useTranslation } from "@/i18n";
import { useCloudInstance } from "@/hooks/useCloudInstance";
import { useHiddenSettings } from "@/hooks/useHiddenSettings";
import { INSTANCE_SETTINGS_PATH_PREFIX } from "@/lib/instance-settings";
import { useLocation, useNavigate } from "@/lib/router";
import { t as i18nT } from "@/i18n";

const items = [
  { value: "general", label: i18nT("settings.general"), href: "/company/settings" },
  { value: "export", label: i18nT("settings.export"), href: "/company/export" },
  { value: "import", label: i18nT("settings.import"), href: "/company/import" },
  { value: "members", label: i18nT("common.members"), href: "/company/settings/members" },
  { value: "secrets", label: i18nT("settings.secrets"), href: "/company/settings/secrets" },
  { value: "api-apps", label: i18nT("settings.apiApps"), href: "/company/settings/api-apps" },
  { value: "instance-profile", label: i18nT("account.profile"), href: `${INSTANCE_SETTINGS_PATH_PREFIX}/profile` },
  { value: "instance-environments", label: i18nT("settings.environments"), href: `${INSTANCE_SETTINGS_PATH_PREFIX}/environments` },
  { value: "instance-access", label: i18nT("settings.access"), href: `${INSTANCE_SETTINGS_PATH_PREFIX}/access` },
  { value: "instance-experimental", label: i18nT("settings.experimental"), href: `${INSTANCE_SETTINGS_PATH_PREFIX}/experimental` },
  { value: "instance-plugins", label: i18nT("settings.plugins"), href: `${INSTANCE_SETTINGS_PATH_PREFIX}/plugins` },
  { value: "instance-adapters", label: i18nT("settings.adapters"), href: `${INSTANCE_SETTINGS_PATH_PREFIX}/adapters` },
  { value: "instance-master-agents", label: i18nT("settings.masterAgents"), href: `${INSTANCE_SETTINGS_PATH_PREFIX}/master-agents` },
  { value: "instance-master-departments", label: i18nT("settings.masterDepartments"), href: `${INSTANCE_SETTINGS_PATH_PREFIX}/master-departments` },
  { value: "instance-master-skills", label: i18nT("settings.masterSkills"), href: `${INSTANCE_SETTINGS_PATH_PREFIX}/master-skills` },
] as const;

type CompanySettingsTab = (typeof items)[number]["value"];

const settingsLabelKeyByTab: Record<CompanySettingsTab, string> = {
  general: "settings.general",
  export: "settings.export",
  import: "settings.import",
  members: "settings.members",
  secrets: "settings.secrets",
  "api-apps": "settings.apiApps",
  "instance-profile": "settings.profile",
  "instance-environments": "settings.environments",
  "instance-access": "settings.access",
  "instance-experimental": "settings.experimental",
  "instance-plugins": "settings.plugins",
  "instance-adapters": "settings.adapters",
  "instance-master-agents": "settings.masterAgents",
  "instance-master-departments": "settings.masterDepartments",
  "instance-master-skills": "settings.masterSkills",
};

/** Tab values suppressed when their page is operator-hidden. */
const hiddenSettingKeyByTab: Partial<Record<CompanySettingsTab, string>> = {
  export: "company.export",
  import: "company.import",
  members: "company.members",
  secrets: "company.secrets",
  "api-apps": "company.apiApps",
  "instance-profile": "instance.profile",
  "instance-environments": "instance.environments",
  "instance-access": "instance.access",
  "instance-experimental": "instance.experimental",
  "instance-plugins": "instance.plugins",
  "instance-adapters": "instance.adapters",
  "instance-master-agents": "instance.masterAgents",
  "instance-master-departments": "instance.masterDepartments",
  "instance-master-skills": "instance.masterSkills",
};

export function getCompanySettingsTab(pathname: string): CompanySettingsTab {
  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/profile`)) {
    return "instance-profile";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/environments`)) {
    return "instance-environments";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/access`)) {
    return "instance-access";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/experimental`)) {
    return "instance-experimental";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/plugins`)) {
    return "instance-plugins";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/adapters`)) {
    return "instance-adapters";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/master-agents`)) {
    return "instance-master-agents";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/master-departments`)) {
    return "instance-master-departments";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/master-skills`)) {
    return "instance-master-skills";
  }

  if (pathname.includes(`${INSTANCE_SETTINGS_PATH_PREFIX}/general`)) {
    return "general";
  }

  if (pathname.includes("/company/settings/environments")) {
    return "instance-environments";
  }

  if (pathname.includes("/company/export")) {
    return "export";
  }

  if (pathname.includes("/company/import")) {
    return "import";
  }

  if (pathname.includes("/company/settings/members") || pathname.includes("/company/settings/access")) {
    return "members";
  }

  if (pathname.includes("/company/settings/invites")) {
    // Invites live on the Members page now; the old URL redirects there.
    return "members";
  }

  if (pathname.includes("/company/settings/secrets")) {
    return "secrets";
  }

  if (pathname.includes("/company/settings/api-apps")) {
    return "api-apps";
  }

  return "general";
}

export function CompanySettingsNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { hidden: hiddenSettings } = useHiddenSettings();
  // Import is floored server-side on cloud-managed instances (403 cloud_managed), so the
  // tab is suppressed there rather than dead-ending.
  const isCloud = Boolean(useCloudInstance());
  const activeTab = getCompanySettingsTab(location.pathname);
  const visibleItems = items.filter((item) => {
    if (item.value === "import" && isCloud) return false;
    const hiddenKey = hiddenSettingKeyByTab[item.value];
    return !hiddenKey || !hiddenSettings.has(hiddenKey);
  });

  function handleTabChange(value: string) {
    const nextTab = visibleItems.find((item) => item.value === value);
    if (!nextTab || nextTab.value === activeTab) return;
    navigate(nextTab.href);
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <PageTabBar
        items={visibleItems.map(({ value }) => ({ value, label: t(settingsLabelKeyByTab[value]) }))}
        value={activeTab}
        onValueChange={handleTabChange}
        align="start"
      />
    </Tabs>
  );
}
