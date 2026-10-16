import { useRef } from "react";
import { Link } from "@/lib/router";
import { MASTER_AGENT_DEPARTMENTS, type MasterAgentDepartment } from "@paperclipai/shared";
import { useTranslation } from "@/i18n";
import { cn } from "../../lib/utils";
import { MasterAgentIcon } from "./master-agent-icons";

export interface GalleryAgent {
  id: string;
  title: string;
  description: string;
  icon: string;
  department: MasterAgentDepartment;
  recommended: boolean;
}

export interface GalleryTeam {
  id: string;
  name: string;
  description: string;
  department: MasterAgentDepartment;
  memberTitles: string[];
}

export type GallerySelection =
  | { kind: "agent"; id: string }
  | { kind: "team"; id: string };

export const GALLERY_DEPARTMENT_LABEL: Record<MasterAgentDepartment, string> = {
  leadership: "onboarding.wizard.gallery.departments.leadership",
  marketing: "onboarding.wizard.gallery.departments.marketing",
  sales: "onboarding.wizard.gallery.departments.sales",
  engineering: "onboarding.wizard.gallery.departments.engineering",
  product: "onboarding.wizard.gallery.departments.product",
  "customer-success": "onboarding.wizard.gallery.departments.customerSuccess",
  "back-office": "onboarding.wizard.gallery.departments.backOffice",
};

function selectionKey(selection: GallerySelection | null) {
  return selection ? `${selection.kind}:${selection.id}` : null;
}

export function MasterAgentGallery({
  agents,
  teams,
  department,
  onDepartment,
  selection,
  onSelect,
  modelMissing,
  isInstanceAdmin,
  error,
}: {
  agents: GalleryAgent[];
  teams: GalleryTeam[];
  department: MasterAgentDepartment;
  onDepartment: (department: MasterAgentDepartment) => void;
  selection: GallerySelection | null;
  onSelect: (selection: GallerySelection) => void;
  modelMissing: boolean;
  isInstanceAdmin: boolean;
  error: string | null;
}) {
  const { t } = useTranslation();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const visibleAgents = agents.filter((agent) => agent.department === department);
  const team = teams.find((row) => row.department === department) ?? null;
  const options: GallerySelection[] = [
    ...visibleAgents.map((agent) => ({ kind: "agent" as const, id: agent.id })),
    ...(team ? [{ kind: "team" as const, id: team.id }] : []),
  ];
  const selectedLabel = (() => {
    if (!selection) return null;
    if (selection.kind === "agent") return agents.find((agent) => agent.id === selection.id)?.title ?? null;
    return teams.find((row) => row.id === selection.id)?.name ?? null;
  })();

  const move = (delta: number) => {
    if (options.length === 0) return;
    const current = options.findIndex((option) => selectionKey(option) === selectionKey(selection));
    const from = current === -1 ? (delta > 0 ? -1 : 0) : current;
    const next = options[(from + delta + options.length) % options.length]!;
    onSelect(next);
    buttons.current.get(selectionKey(next)!)?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted-foreground">{t("onboarding.wizard.gallery.lede")}</p>
      {modelMissing ? (
        <p className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          {t("onboarding.wizard.gallery.modelMissing")}
          {isInstanceAdmin ? (
            <>
              {" "}
              <Link to="/company/settings/instance/master-agents" className="text-foreground underline">
                {t("onboarding.wizard.gallery.setModel")}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {MASTER_AGENT_DEPARTMENTS.map((value) => {
          const count = agents.filter((agent) => agent.department === value).length;
          const label = t(GALLERY_DEPARTMENT_LABEL[value]);
          return (
            <button
              key={value}
              type="button"
              aria-pressed={value === department}
              onClick={() => onDepartment(value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                value === department ? "border-foreground/40 bg-accent text-foreground" : "border-border bg-card text-muted-foreground",
              )}
            >
              {label} {count}
            </button>
          );
        })}
      </div>
      {selectedLabel ? (
        <p className="text-xs text-muted-foreground">{t("onboarding.wizard.gallery.selected", { name: selectedLabel })}</p>
      ) : null}
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("onboarding.wizard.gallery.empty")}</p>
      ) : (
        <div role="radiogroup" aria-label={t(GALLERY_DEPARTMENT_LABEL[department])} className="flex flex-col gap-2" onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowRight") {
            event.preventDefault();
            move(1);
          }
          if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
            event.preventDefault();
            move(-1);
          }
        }}>
          {visibleAgents.map((agent) => {
            const option = { kind: "agent" as const, id: agent.id };
            const selected = selectionKey(selection) === selectionKey(option);
            return (
              <button
                key={agent.id}
                ref={(node) => {
                  const key = selectionKey(option)!;
                  if (node) buttons.current.set(key, node);
                  else buttons.current.delete(key);
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSelect(option)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "border-foreground/40 bg-accent" : "border-border bg-card hover:bg-accent/40",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border">
                  <MasterAgentIcon name={agent.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{agent.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{agent.description}</span>
                </span>
                {agent.recommended ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{t("onboarding.wizard.gallery.recommended")}</span>
                ) : null}
              </button>
            );
          })}
          {team ? (
            <button
              ref={(node) => {
                const key = selectionKey({ kind: "team", id: team.id })!;
                if (node) buttons.current.set(key, node);
                else buttons.current.delete(key);
              }}
              type="button"
              role="radio"
              aria-checked={selectionKey(selection) === selectionKey({ kind: "team", id: team.id })}
              onClick={() => onSelect({ kind: "team", id: team.id })}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selectionKey(selection) === selectionKey({ kind: "team", id: team.id })
                  ? "border-foreground/40 bg-accent"
                  : "border-border bg-card hover:bg-accent/40",
              )}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border">
                <MasterAgentIcon name="users" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {t("onboarding.wizard.gallery.hireTeam", { department: t(GALLERY_DEPARTMENT_LABEL[department]) })}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{team.memberTitles.join(", ")}</span>
              </span>
            </button>
          ) : null}
        </div>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
