import { AgentAvatar } from "@/components/AgentAvatar";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Braces,
  Clock3,
  Edit3,
  Play,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioCardGroup } from "@/components/ui/radio-card";
import { cn } from "@/lib/utils";
import { nextCronFires, previewFirePolicies } from "../../lib/cron-fires";
import { timeAgo } from "../../lib/timeAgo";
import { useTranslation } from "@/i18n";
import { EmptyState } from "../EmptyState";
import { InlineEntitySelector } from "../InlineEntitySelector";
import { DocumentAnnotationsCountChip, IssueDocumentAnnotations } from "../IssueDocumentAnnotations";
import { MarkdownEditor } from "../MarkdownEditor";
import { RoutineVariablesEditor, RoutineVariablesHint } from "../RoutineVariablesEditor";
import { EnvironmentVariablesEditor } from "../environment-variables-editor";
import { useRoutineDetail } from "./context";
import type { EnvBinding, RoutineDetail as RoutineDetailType } from "@paperclipai/shared";
import { t as i18nT } from "@/i18n";

const concurrencyPolicyOptions = [
  {
    value: "coalesce_if_active",
    title: i18nT("pages.routines.concurrencyOption.coalesce_if_active"),
    description: "Keep one follow-up run queued while an active run is still working.",
  },
  {
    value: "always_enqueue",
    title: i18nT("pages.routines.concurrencyOption.always_enqueue"),
    description: "Queue every trigger occurrence, even if several runs stack up.",
  },
  {
    value: "skip_if_active",
    title: i18nT("pages.routines.concurrencyOption.skip_if_active"),
    description: "Drop overlapping trigger occurrences while the routine is already active.",
  },
];

const catchUpPolicyOptions = [
  {
    value: "skip_missed",
    title: i18nT("pages.routines.catchUpOption.skip_missed"),
    description: "Ignore schedule windows that were missed while paused.",
  },
  {
    value: "enqueue_missed_with_cap",
    title: i18nT("pages.routines.catchUpOption.enqueue_missed_with_cap"),
    description: "Catch up missed schedule windows after recovery; sub-hourly schedules are combined into one catch-up run, slower schedules replay each missed window up to a cap.",
  },
];

const activityGatePolicyOptions = [
  {
    value: "always",
    title: i18nT("pages.routines.activityGate.always"),
    description: "Fire on the schedule no matter what — the default behavior.",
  },
  {
    value: "require_external_activity",
    title: i18nT("pages.routines.activityGate.require_external_activity"),
    description:
      "On a scheduled tick, only run if something happened since the last run that finished. Lets a watcher-style routine stay asleep while the system is settled instead of burning tokens.",
  },
];

const activityGateScopeOptions = [
  {
    value: "company",
    title: i18nT("pages.routines.activityGateScope.company"),
    description: "Any activity across the organization counts as a reason to run.",
  },
  {
    value: "project",
    title: i18nT("pages.routines.activityGateScope.project"),
    description: "Only activity in the routine's project counts as a reason to run.",
  },
];

export function OverviewSection({
  defaultDescriptionAnnotationsOpen = false,
}: {
  defaultDescriptionAnnotationsOpen?: boolean;
} = {}) {
  const { t } = useTranslation();
  const ctx = useRoutineDetail();
  const {
    routine,
    editDraft,
    setEditDraft,
    assigneeOptions,
    projectOptions,
    recentAssigneeIds,
    recentProjectIds,
    agentById,
    projectById,
    currentAssignee,
    currentProject,
    mentionOptions,
    assigneeSelectorRef,
    projectSelectorRef,
    descriptionEditorRef,
    routineRuns,
    activity,
    saveRoutine,
    saveConflict,
    isSectionDirty,
    navigateToSection,
  } = ctx;
  const [descriptionAnnotationsOpen, setDescriptionAnnotationsOpen] = useState(defaultDescriptionAnnotationsOpen);

  const activeTriggers = routine.triggers.length;
  const nextFire = useMemo(() => {
    const upcoming = routine.triggers
      .filter((trigger) => trigger.kind === "schedule" && trigger.nextRunAt)
      .map((trigger) => new Date(trigger.nextRunAt as Date))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    return upcoming ? upcoming.toLocaleString() : null;
  }, [routine.triggers]);
  const lastRun = (routineRuns ?? [])[0] ?? null;
  const recentActivity = (activity ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Assignment row */}
      <div className="overflow-x-auto overscroll-x-contain">
        <div className="inline-flex min-w-full flex-wrap items-center gap-2 text-sm text-muted-foreground sm:min-w-max sm:flex-nowrap">
          <span>{t("pages.routines.forLabel")}</span>
          <InlineEntitySelector
            ref={assigneeSelectorRef}
            value={editDraft.assigneeAgentId}
            options={assigneeOptions}
            recentOptionIds={recentAssigneeIds}
            placeholder={t("pages.routines.responsible")}
            noneLabel={t("pages.routines.noResponsible")}
            searchPlaceholder={t("pages.routines.searchResponsible")}
            emptyMessage={t("pages.routines.noResponsibleFound")}
            onChange={(assigneeAgentId) =>
              setEditDraft((current) => ({ ...current, assigneeAgentId }))
            }
            onConfirm={() => {
              if (editDraft.projectId) {
                descriptionEditorRef.current?.focus();
              } else {
                projectSelectorRef.current?.focus();
              }
            }}
            renderTriggerValue={(option) =>
              option ? (
                currentAssignee ? (
                  <>
                    <AgentAvatar agent={currentAssignee} size={16} className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/>
                    <span className="truncate">{option.label}</span>
                  </>
                ) : (
                  <span className="truncate">{option.label}</span>
                )
              ) : (
                <span className="text-muted-foreground">{t("pages.routines.responsible")}</span>
              )
            }
            renderOption={(option) => {
              if (!option.id) return <span className="truncate">{option.label}</span>;
              const assignee = agentById.get(option.id);
              return (
                <>
                  {assignee ? (
                    <AgentAvatar agent={assignee} size={16} className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/>
                  ) : null}
                  <span className="truncate">{option.label}</span>
                </>
              );
            }}
          />
          <span>{t("pages.routines.inLabel")}</span>
          <InlineEntitySelector
            ref={projectSelectorRef}
            value={editDraft.projectId}
            options={projectOptions}
            recentOptionIds={recentProjectIds}
            placeholder={t("pages.routines.project")}
            noneLabel={t("issues.dialog.noProject")}
            searchPlaceholder={t("issues.dialog.searchProjects")}
            emptyMessage={t("issues.dialog.noProjectsFound")}
            onChange={(projectId) => setEditDraft((current) => ({ ...current, projectId }))}
            onConfirm={() => descriptionEditorRef.current?.focus()}
            renderTriggerValue={(option) =>
              option && currentProject ? (
                <>
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: currentProject.color ?? "var(--project-none)" }}
                  />
                  <span className="truncate">{option.label}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{t("pages.routines.project")}</span>
              )
            }
            renderOption={(option) => {
              if (!option.id) return <span className="truncate">{option.label}</span>;
              const project = projectById.get(option.id);
              return (
                <>
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: project?.color ?? "var(--project-none)" }}
                  />
                  <span className="truncate">{option.label}</span>
                </>
              );
            }}
          />
        </div>
      </div>

      {!routine.assigneeAgentId ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-200">
          Default agent required. This routine can stay as a draft and still run manually, but
          automation stays paused until you assign a default agent.
        </div>
      ) : null}

      {/* Instructions */}
      <div className="space-y-2">
        <div className="flex items-center justify-end">
          {routine.descriptionDocument ? (
            <DocumentAnnotationsCountChip
              issueId={routine.id}
              docKey="description"
              target={{ kind: "routine", routineId: routine.id, documentKey: "description" }}
              panelOpen={descriptionAnnotationsOpen}
              onToggle={() => setDescriptionAnnotationsOpen((open) => !open)}
            />
          ) : null}
        </div>
        {routine.descriptionDocument ? (
          <IssueDocumentAnnotations
            issueId={routine.id}
            doc={routine.descriptionDocument}
            target={{ kind: "routine", routineId: routine.id, documentKey: "description" }}
            bodyMarkdown={editDraft.description}
            draftDirty={isSectionDirty("overview") || saveRoutine.isPending}
            draftConflicted={saveConflict}
            historicalPreview={false}
            locationHash={typeof window === "undefined" ? "" : window.location.hash}
            panelOpen={descriptionAnnotationsOpen}
            onPanelOpenChange={setDescriptionAnnotationsOpen}
          >
            <MarkdownEditor
              ref={descriptionEditorRef}
              value={editDraft.description}
              onChange={(description) => setEditDraft((current) => ({ ...current, description }))}
              placeholder={t("pages.routines.addInstructions")}
              bordered={false}
              contentClassName="min-h-(--sz-120px) text-sm leading-7"
              mentions={mentionOptions}
              onSubmit={() => {
                if (!saveRoutine.isPending && editDraft.title.trim()) {
                  saveRoutine.mutate();
                }
              }}
            />
          </IssueDocumentAnnotations>
        ) : (
          <MarkdownEditor
            ref={descriptionEditorRef}
            value={editDraft.description}
            onChange={(description) => setEditDraft((current) => ({ ...current, description }))}
            placeholder={t("pages.routines.addInstructions")}
            bordered={false}
            contentClassName="min-h-(--sz-120px) text-sm leading-7"
            mentions={mentionOptions}
            onSubmit={() => {
              if (!saveRoutine.isPending && editDraft.title.trim()) {
                saveRoutine.mutate();
              }
            }}
          />
        )}
      </div>

      {/* Variables peek */}
      <div className="space-y-3">
        <RoutineVariablesHint />
        <RoutineVariablesEditor
          title={editDraft.title}
          description={editDraft.description}
          value={editDraft.variables}
          onChange={(variables) => setEditDraft((current) => ({ ...current, variables }))}
        />
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard
          icon={Clock3}
          label={t("pages.routineDetail.overview.triggers")}
          value={activeTriggers === 0 ? t("pages.routineDetail.overview.none") : t("pages.routineDetail.overview.activeCount", { count: activeTriggers })}
          hint={nextFire ? t("pages.routineDetail.overview.nextFire", { time: nextFire }) : t("pages.routineDetail.overview.noSchedule")}
          to={() => navigateToSection("triggers")}
          ariaLabel={t("pages.routineDetail.overview.openTriggers", { count: activeTriggers })}
        />
        <SummaryCard
          icon={Play}
          label={t("pages.routineDetail.overview.lastRun")}
          value={lastRun ? lastRun.status.replaceAll("_", " ") : t("pages.routineDetail.overview.noRuns")}
          hint={lastRun ? timeAgo(lastRun.triggeredAt) : t("pages.routineDetail.overview.triggerARun")}
          to={() => navigateToSection("runs")}
          ariaLabel={lastRun ? t("pages.routineDetail.overview.lastRunStatus", { status: lastRun.status }) : t("pages.routineDetail.overview.noRunsOpen")}
        />
      </div>

      {/* Recent activity */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("pages.routineDetail.overview.recentActivity")}
        </p>
        {recentActivity.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("pages.routineDetail.activityEmpty")}</p>
        ) : (
          <div className="divide-y divide-border/60">
            {recentActivity.map((event) => (
              <div key={event.id} className="flex items-center gap-2 py-1.5 text-xs">
                <Badge variant="outline" className="shrink-0 font-mono">
                  {event.action}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {event.details && Object.keys(event.details).length > 0
                    ? Object.keys(event.details).slice(0, 3).join(" · ")
                    : ""}
                </span>
                <span className="shrink-0 text-muted-foreground/60">{timeAgo(event.createdAt)}</span>
              </div>
            ))}
            <button
              type="button"
              onClick={() => navigateToSection("activity")}
              className="flex items-center gap-1 pt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {t("pages.routineDetail.overview.viewAllActivity")} <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
  ariaLabel,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  hint: string;
  to: () => void;
  ariaLabel: string;
}) {
  return (
    <button type="button" onClick={to} aria-label={ariaLabel} className="text-left">
      <Card className="gap-2 p-4 transition-colors hover:border-border hover:bg-accent/30">
        <CardContent className="space-y-1 p-0">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
            {label}
            <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
          <p className="text-lg font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </button>
  );
}

export { RoutineTriggers as TriggersSection } from "../routine-triggers/RoutineTriggers";

export function VariablesSection() {
  const { t } = useTranslation();
  const ctx = useRoutineDetail();
  const { editDraft, setEditDraft, navigateToSection } = ctx;
  const hasVariables = editDraft.variables.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-4 py-3 text-xs">
        <span className="flex-1 text-muted-foreground">
          {t("pages.routineDetail.variablesHintBefore")}{" "}
          <code className="font-mono">{"{{placeholders}}"}</code>{" "}
          {t("pages.routineDetail.variablesHintAfter")}
        </span>
        <Button variant="secondary" size="sm" onClick={() => navigateToSection("overview")}>
          <Edit3 className="mr-1.5 h-3.5 w-3.5" />
          {t("pages.routineDetail.editInstructions")}
        </Button>
      </div>

      {hasVariables ? (
        <RoutineVariablesEditor
          title={editDraft.title}
          description={editDraft.description}
          value={editDraft.variables}
          onChange={(variables) => setEditDraft((current) => ({ ...current, variables }))}
        />
      ) : (
        <EmptyState
          icon={Braces}
          message={t("pages.routineDetail.variablesEmpty")}
          action={t("pages.routineDetail.editInstructions")}
          onAction={() => navigateToSection("overview")}
        />
      )}
    </div>
  );
}

export function SecretsSection() {
  const { t } = useTranslation();
  const ctx = useRoutineDetail();
  const { editDraft, setEditDraft, availableSecrets, createSecret } = ctx;

  // Project/company-scoped secrets that already see real usage, surfaced as
  // quick-bind chips (§3.4). Ranked by reference count then recency.
  const recentlyUsedSecrets = useMemo(
    () =>
      [...availableSecrets]
        .filter((secret) => secret.status === "active")
        .sort((a, b) => {
          const refDelta = (b.referenceCount ?? 0) - (a.referenceCount ?? 0);
          if (refDelta !== 0) return refDelta;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        })
        .slice(0, 8),
    [availableSecrets],
  );

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        {t("pages.routineDetail.secretsHint")}
      </div>


      <EnvironmentVariablesEditor
        value={(editDraft.env ?? {}) as Record<string, EnvBinding>}
        secrets={availableSecrets}
        recentlyUsedSecrets={recentlyUsedSecrets}
        onCreateSecret={async (name, value) => createSecret.mutateAsync({ name, value })}
        onChange={(env) => setEditDraft((current) => ({ ...current, env: env ?? null }))}
      />
    </div>
  );
}

export function DeliverySection() {
  const { t } = useTranslation();
  const ctx = useRoutineDetail();
  const { editDraft, setEditDraft, routine } = ctx;
  const concurrencyOptions = concurrencyPolicyOptions.map((option) => ({
    value: option.value,
    title: t(`pages.routines.concurrencyOption.${option.value}`),
    description: t(`pages.routines.concurrencyPolicy.${option.value}`),
  }));
  const catchUpOptions = catchUpPolicyOptions.map((option) => ({
    value: option.value,
    title: t(`pages.routines.catchUpOption.${option.value}`),
    description: t(`pages.routines.catchUpPolicy.${option.value}`),
  }));
  const activityGateOptions = activityGatePolicyOptions.map((option) => ({
    value: option.value,
    title: t(`pages.routines.activityGate.${option.value}`),
    description: t(`pages.routines.activityGate.${option.value}Hint`),
  }));
  const activityScopeOptions = activityGateScopeOptions.map((option) => ({
    value: option.value,
    title: t(`pages.routines.activityGateScope.${option.value}`),
    description: t(`pages.routines.activityGateScope.${option.value}Hint`),
  }));

  // The activity gate only affects schedule ticks (webhook/manual/API fires are
  // themselves activity and always run), so the control is only meaningful for
  // routines that have a schedule trigger. Disable — rather than hide — it
  // elsewhere so the capability stays discoverable.
  const hasScheduleTrigger = routine.triggers.some((trigger) => trigger.kind === "schedule");
  const gateEnabled = editDraft.activityGatePolicy === "require_external_activity";

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-(--tracking-caps) text-muted-foreground">
          {t("pages.routines.concurrency")}
        </p>
        <RadioCardGroup
          ariaLabel={t("pages.routines.concurrency")}
          value={editDraft.concurrencyPolicy}
          onValueChange={(concurrencyPolicy) =>
            setEditDraft((current) => ({ ...current, concurrencyPolicy }))
          }
          options={concurrencyOptions}
        />
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-(--tracking-caps) text-muted-foreground">
          {t("pages.routines.catchUp")}
        </p>
        <RadioCardGroup
          ariaLabel={t("pages.routines.catchUp")}
          value={editDraft.catchUpPolicy}
          onValueChange={(catchUpPolicy) =>
            setEditDraft((current) => ({ ...current, catchUpPolicy }))
          }
          options={catchUpOptions}
        />
      </div>
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-(--tracking-caps) text-muted-foreground">
          {t("pages.routines.advancedRunPolicy")}
        </p>
        <RadioCardGroup
          ariaLabel={t("pages.routines.advancedRunPolicy")}
          value={editDraft.activityGatePolicy}
          onValueChange={(activityGatePolicy) =>
            setEditDraft((current) => ({ ...current, activityGatePolicy }))
          }
          options={activityGateOptions}
          disabled={!hasScheduleTrigger}
        />
        {!hasScheduleTrigger ? (
          <p className="text-xs text-muted-foreground">
            {t("pages.routines.activityGateNeedsSchedule")}
          </p>
        ) : gateEnabled ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <Label className="text-xs font-medium">{t("pages.routines.activityScope")}</Label>
            <RadioCardGroup
              ariaLabel={t("pages.routines.activityScope")}
              value={editDraft.activityGateScope}
              onValueChange={(activityGateScope) =>
                setEditDraft((current) => ({ ...current, activityGateScope }))
              }
              options={activityScopeOptions}
            />
          </div>
        ) : null}
      </div>
      <NextFiresPreview
        triggers={routine.triggers}
        concurrencyPolicy={editDraft.concurrencyPolicy}
      />
    </div>
  );
}

const dispositionToneClass: Record<string, string> = {
  queued: "text-emerald-600 dark:text-emerald-400",
  coalesced: "text-amber-600 dark:text-amber-400",
  skipped: "text-muted-foreground",
};

/**
 * "Next 5 fires" preview (§3.5) — the strongest "what does this policy mean?"
 * surface. Picks the soonest-firing schedule trigger, computes its next fires
 * client-side, and annotates each with how the chosen concurrency policy would
 * treat it.
 */
function NextFiresPreview({
  triggers,
  concurrencyPolicy,
}: {
  triggers: RoutineDetailType["triggers"];
  concurrencyPolicy: string;
}) {
  const { t } = useTranslation();
  const preview = useMemo(() => {
    const schedule = triggers
      .filter((trigger) => trigger.kind === "schedule" && trigger.enabled && trigger.cronExpression)
      .map((trigger) => {
        const fires = nextCronFires(trigger.cronExpression, 5, {
          timeZone: trigger.timezone ?? "UTC",
        });
        return { trigger, fires };
      })
      .filter((entry) => entry.fires.length > 0)
      .sort((a, b) => a.fires[0]!.getTime() - b.fires[0]!.getTime())[0];
    if (!schedule) return null;
    return {
      timeZone: schedule.trigger.timezone ?? "UTC",
      entries: previewFirePolicies(schedule.fires, concurrencyPolicy),
    };
  }, [triggers, concurrencyPolicy]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-(--tracking-caps) text-muted-foreground">
        {t("pages.routines.nextFires")}
      </p>
      {preview ? (
        <>
          <div className="space-y-1.5 rounded-lg border border-border p-3 font-mono text-xs">
            {preview.entries.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-muted-foreground/40">·</span>
                <span className="tabular-nums">{formatFireTime(entry.at, preview.timeZone)}</span>
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                <span className={cn("font-medium", dispositionToneClass[entry.disposition])}>
                  {t(`pages.routines.fireDisposition.${entry.disposition}`)}
                </span>
                {entry.note ? (
                  <span className="truncate text-muted-foreground/60">({t("pages.routines.fireDisposition.stillActive")})</span>
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-(length:--text-micro) text-muted-foreground/60">
            {t("pages.routines.nextFiresNote", { timeZone: preview.timeZone })}
          </p>
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          {t("pages.routines.nextFiresEmpty")}
        </p>
      )}
    </div>
  );
}

function formatFireTime(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(date)
      .replace(",", "");
  } catch {
    return date.toISOString();
  }
}
