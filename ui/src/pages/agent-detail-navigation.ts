import { t } from "@/i18n";
import { auditSectionHref, type AuditSection } from "./audit/audit-navigation";

export type AgentDetailView =
  | "overview"
  | "instructions"
  | "skills"
  | "runtime"
  | "secrets"
  | "tools"
  | "channels"
  | "permissions"
  | "api-keys"
  | "revisions"
  | "run-detail";

export type AgentLocalDetailView = Exclude<AgentDetailView, "run-detail">;

export const AGENT_DETAIL_NAVIGATION: ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{ value: AgentLocalDetailView; label: string }>;
}> = [
  {
    label: "Agent",
    items: [
      { value: "overview", label: "Overview" },
      { value: "instructions", label: "Instructions" },
      { value: "skills", label: "Skills" },
    ],
  },
  {
    label: "Runtime",
    items: [
      { value: "runtime", label: "Harness / Runtime" },
      { value: "secrets", label: "Secrets" },
      { value: "tools", label: "Tools" },
      { value: "channels", label: "Channels" },
    ],
  },
  {
    label: "Governance",
    items: [
      { value: "permissions", label: "Permissions / Trust" },
      { value: "api-keys", label: "API Keys" },
      { value: "revisions", label: "Revisions" },
    ],
  },
] as const;

export function parseAgentDetailView(value: string | null): AgentLocalDetailView {
  if (value === "instructions" || value === "prompts") return "instructions";
  if (value === "skills") return "skills";
  if (value === "runtime" || value === "configure" || value === "configuration") return "runtime";
  if (value === "secrets") return "secrets";
  if (value === "tools") return "tools";
  if (value === "channels") return "channels";
  if (value === "permissions" || value === "trust") return "permissions";
  if (value === "api-keys" || value === "keys") return "api-keys";
  if (value === "revisions" || value === "history") return "revisions";
  return "overview";
}

export function agentDetailHref(agentRef: string, view: AgentLocalDetailView = "overview") {
  return `/agents/${agentRef}/${view}`;
}

export function agentLegacyAuditSection(value: string | null): AuditSection | null {
  if (value === "runs") return "runs";
  if (value === "audit" || value === "activity") return "activity";
  if (value === "cost" || value === "costs") return "costs";
  if (value === "budget" || value === "budgets") return "budgets";
  return null;
}

export function agentLocalNavLabel(value: AgentLocalDetailView): string {
  switch (value) {
    case "overview":
      return t("common.overview");
    case "instructions":
      return t("agents.instructions");
    case "skills":
      return t("nav.skills");
    case "runtime":
      return t("agents.harnessRuntime");
    case "secrets":
      return t("agents.secretsAndVariables");
    case "tools":
      return t("apps.tools");
    case "channels":
      return t("apps.channels");
    case "permissions":
      return t("agents.permissionsTrust");
    case "api-keys":
      return t("settings.apiKeys");
    case "revisions":
      return t("agents.revisions");
    default: {
      const exhaustive: never = value;
      return exhaustive;
    }
  }
}

export function agentNavSectionLabel(label: string): string {
  switch (label) {
    case "Agent":
      return t("agents.sectionAgent");
    case "Runtime":
      return t("agents.sectionRuntime");
    case "Governance":
      return t("agents.sectionGovernance");
    default:
      return label;
  }
}

export function agentLegacyTabLabel(value: string): string {
  switch (value) {
    case "dashboard":
      return t("nav.dashboard");
    case "instructions":
      return t("agents.instructions");
    case "skills":
      return t("nav.skills");
    case "configuration":
      return t("apps.configuration");
    case "secrets":
      return t("settings.secrets");
    case "tools":
      return t("apps.tools");
    case "channels":
      return t("apps.channels");
    case "runs":
      return t("nav.runs");
    case "audit":
      return t("apps.audit");
    case "budget":
      return t("agents.budget");
    default:
      return value;
  }
}

export function agentScopedAuditHref(agentId: string, section: AuditSection) {
  return auditSectionHref(section, {
    mode: section === "activity" ? "agents" : undefined,
    agentId,
  });
}
