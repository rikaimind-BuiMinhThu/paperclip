import { useRef } from "react";
import { Link } from "@/lib/router";
import type { MasterAgentDepartment } from "@paperclipai/shared";
import { useTranslation } from "@/i18n";
import { cn } from "../../lib/utils";
import { AgentAvatar } from "../AgentAvatar";
import { MasterAgentIcon } from "./master-agent-icons";

export interface GalleryDepartment {
  slug: string;
  name: string;
}

export interface GalleryAgent {
  id: string;
  title: string;
  description: string;
  icon: string;
  department: string;
  recommended: boolean;
}

export interface GalleryTeam {
  id: string;
  name: string;
  description: string;
  department: string;
  memberTitles: string[];
  memberIds: string[];
  managerId: string | null;
}

export type GallerySelection =
  | { kind: "agent"; id: string }
  | { kind: "team"; id: string };

/** i18n overlay for seeded department slugs; custom departments use API name. */
export const GALLERY_DEPARTMENT_LABEL: Record<MasterAgentDepartment, string> = {
  leadership: "onboarding.wizard.gallery.departments.leadership",
  marketing: "onboarding.wizard.gallery.departments.marketing",
  sales: "onboarding.wizard.gallery.departments.sales",
  engineering: "onboarding.wizard.gallery.departments.engineering",
  product: "onboarding.wizard.gallery.departments.product",
  "customer-success": "onboarding.wizard.gallery.departments.customerSuccess",
  "back-office": "onboarding.wizard.gallery.departments.backOffice",
};

export function galleryDepartmentLabel(
  t: (key: string) => string,
  department: GalleryDepartment | { slug: string; name: string },
): string {
  const key = GALLERY_DEPARTMENT_LABEL[department.slug as MasterAgentDepartment];
  return key ? t(key) : department.name;
}

const EMPTY_HIRED = new Set<string>();

function selectionKey(selection: GallerySelection | null) {
  return selection ? `${selection.kind}:${selection.id}` : null;
}

const TEAM_AVATAR_STACK_MAX = 4;

function GalleryTeamAvatarStack({ memberIds }: { memberIds: string[] }) {
  const visible = memberIds.slice(0, TEAM_AVATAR_STACK_MAX);
  if (visible.length === 0) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border">
        <MasterAgentIcon name="users" />
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      <span className="flex -space-x-2">
        {visible.map((memberId) => (
          <AgentAvatar
            key={memberId}
            agent={{ id: memberId }}
            size={32}
            pose="rest"
            className="ring-2 ring-background"
          />
        ))}
      </span>
    </span>
  );
}

function teamHireState(memberIds: string[], hiredMasterAgentIds: ReadonlySet<string>) {
  if (memberIds.length === 0) return { disabled: false, allHired: false } as const;
  const hiredCount = memberIds.filter((id) => hiredMasterAgentIds.has(id)).length;
  const allHired = hiredCount === memberIds.length;
  const anyHired = hiredCount > 0;
  return { disabled: anyHired, allHired } as const;
}

export function MasterAgentGallery({
  agents,
  teams,
  departments,
  department,
  onDepartment,
  selection,
  onSelect,
  modelMissing,
  isInstanceAdmin,
  error,
  hiredMasterAgentIds = EMPTY_HIRED,
}: {
  agents: GalleryAgent[];
  teams: GalleryTeam[];
  departments: GalleryDepartment[];
  department: string;
  onDepartment: (department: string) => void;
  selection: GallerySelection | null;
  onSelect: (selection: GallerySelection) => void;
  modelMissing: boolean;
  isInstanceAdmin: boolean;
  error: string | null;
  hiredMasterAgentIds?: ReadonlySet<string>;
}) {
  const { t } = useTranslation();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const activeDepartment =
    departments.find((row) => row.slug === department) ??
    departments[0] ??
    { slug: department, name: department };
  const visibleAgents = agents.filter((agent) => agent.department === activeDepartment.slug);
  const team = teams.find((row) => row.department === activeDepartment.slug) ?? null;
  const teamState = team ? teamHireState(team.memberIds, hiredMasterAgentIds) : null;
  const selectableOptions: GallerySelection[] = [
    ...visibleAgents
      .filter((agent) => !hiredMasterAgentIds.has(agent.id))
      .map((agent) => ({ kind: "agent" as const, id: agent.id })),
    ...(team && teamState && !teamState.disabled ? [{ kind: "team" as const, id: team.id }] : []),
  ];
  const selectedLabel = (() => {
    if (!selection) return null;
    if (selection.kind === "agent") return agents.find((agent) => agent.id === selection.id)?.title ?? null;
    return teams.find((row) => row.id === selection.id)?.name ?? null;
  })();

  const move = (delta: number) => {
    if (selectableOptions.length === 0) return;
    const current = selectableOptions.findIndex((option) => selectionKey(option) === selectionKey(selection));
    const from = current === -1 ? (delta > 0 ? -1 : 0) : current;
    const next = selectableOptions[(from + delta + selectableOptions.length) % selectableOptions.length]!;
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
        {departments.map((row) => {
          const count = agents.filter((agent) => agent.department === row.slug).length;
          const label = galleryDepartmentLabel(t, row);
          return (
            <button
              key={row.slug}
              type="button"
              aria-pressed={row.slug === activeDepartment.slug}
              onClick={() => onDepartment(row.slug)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs",
                row.slug === activeDepartment.slug ? "border-foreground/40 bg-accent text-foreground" : "border-border bg-card text-muted-foreground",
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
      {visibleAgents.length === 0 && !team ? (
        <p className="text-sm text-muted-foreground">{t("onboarding.wizard.gallery.empty")}</p>
      ) : (
        <div role="radiogroup" aria-label={galleryDepartmentLabel(t, activeDepartment)} className="flex flex-col gap-2" onKeyDown={(event) => {
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
            const hired = hiredMasterAgentIds.has(agent.id);
            const selected = !hired && selectionKey(selection) === selectionKey(option);
            return (
              <button
                key={agent.id}
                ref={(node) => {
                  const key = selectionKey(option)!;
                  if (node && !hired) buttons.current.set(key, node);
                  else buttons.current.delete(key);
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={hired || undefined}
                disabled={hired}
                onClick={() => {
                  if (!hired) onSelect(option);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  hired
                    ? "cursor-not-allowed border-border bg-muted/40 opacity-70"
                    : selected
                      ? "border-foreground/40 bg-accent"
                      : "border-border bg-card hover:bg-accent/40",
                )}
              >
                <AgentAvatar
                  agent={{ id: agent.id, name: agent.title }}
                  size={32}
                  pose="rest"
                  className="shrink-0"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{agent.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{agent.description}</span>
                </span>
                {hired ? (
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {t("onboarding.wizard.gallery.hired")}
                  </span>
                ) : agent.recommended ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{t("onboarding.wizard.gallery.recommended")}</span>
                ) : null}
              </button>
            );
          })}
          {team && teamState ? (
            <button
              ref={(node) => {
                const key = selectionKey({ kind: "team", id: team.id })!;
                if (node && !teamState.disabled) buttons.current.set(key, node);
                else buttons.current.delete(key);
              }}
              type="button"
              role="radio"
              aria-checked={!teamState.disabled && selectionKey(selection) === selectionKey({ kind: "team", id: team.id })}
              aria-disabled={teamState.disabled || undefined}
              disabled={teamState.disabled}
              onClick={() => {
                if (!teamState.disabled) onSelect({ kind: "team", id: team.id });
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                teamState.disabled
                  ? "cursor-not-allowed border-border bg-muted/40 opacity-70"
                  : selectionKey(selection) === selectionKey({ kind: "team", id: team.id })
                    ? "border-foreground/40 bg-accent"
                    : "border-border bg-card hover:bg-accent/40",
              )}
            >
              <GalleryTeamAvatarStack memberIds={team.memberIds} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {t("onboarding.wizard.gallery.hireTeam", {
                    department: galleryDepartmentLabel(t, activeDepartment),
                  })}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{team.memberTitles.join(", ")}</span>
              </span>
              {teamState.allHired ? (
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {t("onboarding.wizard.gallery.hired")}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
