import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FlaskConical, Lock, Play } from "lucide-react";
import type {
  InstanceExperimentalSettings,
  InstanceExperimentalSettingsWithManaged,
  InstanceFeatureKey,
  ManagedSettingMetadata,
  PatchInstanceExperimentalSettings,
} from "@paperclipai/shared";
import { experimentalSettingKey } from "@paperclipai/shared";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useHiddenSettings } from "@/hooks/useHiddenSettings";
import { getWorktreeInstanceId, isWorktreeRuntime } from "../lib/worktree-branding";
import { useTranslation } from "@/i18n";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type WorktreeRunExecutionDisplayState =
  | { kind: "off" }
  | { kind: "armed"; activatedAt: string }
  | { kind: "fail_closed"; reason: "missing_cutoff" | "missing_instance_id" | "instance_mismatch" };

/**
 * Mirror of the server's `resolveWorktreeRunExecutionActivation` fail-closed
 * ladder (server/src/services/instance-settings.ts) so the card never claims a
 * copied/legacy row is arming execution. The derived fields are display-only —
 * the PATCH the toggle sends still writes just the boolean.
 */
function resolveWorktreeRunExecutionDisplayState(
  settings:
    | Pick<
        InstanceExperimentalSettings,
        | "enableWorktreeRunExecution"
        | "worktreeRunExecutionActivatedAt"
        | "worktreeRunExecutionActivationInstanceId"
      >
    | undefined,
  currentInstanceId: string | null,
): WorktreeRunExecutionDisplayState {
  if (settings?.enableWorktreeRunExecution !== true) return { kind: "off" };
  if (!settings.worktreeRunExecutionActivatedAt) return { kind: "fail_closed", reason: "missing_cutoff" };
  if (!currentInstanceId) return { kind: "fail_closed", reason: "missing_instance_id" };
  if (settings.worktreeRunExecutionActivationInstanceId !== currentInstanceId) {
    return { kind: "fail_closed", reason: "instance_mismatch" };
  }
  return { kind: "armed", activatedAt: settings.worktreeRunExecutionActivatedAt };
}

function formatActivationTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// PAP-11233: keep Conference Room code intact, but hide the user-facing opt-in for now.
const SHOW_CONFERENCE_ROOM_EXPERIMENTAL_SETTING = false;

function ManagedByCloudBadge() {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Lock aria-hidden="true" />
      Managed by Kujira AI Harness Cloud
    </Badge>
  );
}

function ExperimentalToggleCard({
  title,
  description,
  footnote,
  checked,
  onCheckedChange,
  disabled,
  settingKey,
  managed,
  ariaLabel,
}: {
  title: string;
  description: string;
  footnote?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  /** Flag key backing this card; operator-hidden keys render nothing. */
  settingKey: InstanceFeatureKey;
  managed?: ManagedSettingMetadata;
  ariaLabel: string;
}) {
  const { hidden: hiddenSettings } = useHiddenSettings();
  const isManaged = managed?.managed === true;
  if (hiddenSettings.has(experimentalSettingKey(settingKey))) return null;
  return (
    <Card className="block bg-transparent p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            {isManaged ? <ManagedByCloudBadge /> : null}
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          {footnote ? <p className="max-w-2xl text-xs text-muted-foreground">{footnote}</p> : null}
        </div>
        <ToggleSwitch
          checked={checked}
          onCheckedChange={(next) => {
            if (isManaged) return;
            onCheckedChange(next);
          }}
          disabled={disabled || isManaged}
          aria-label={ariaLabel}
        />
      </div>
    </Card>
  );
}

export function InstanceExperimentalSettings() {
  const { t } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { hidden: hiddenSettings } = useHiddenSettings();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("settings.title"), href: "/company/settings" },
      { label: t("pages.instanceExperimental.title") },
    ]);
  }, [setBreadcrumbs, t]);

  const experimentalQuery = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });

  const toggleMutation = useMutation<
    InstanceExperimentalSettingsWithManaged,
    Error,
    PatchInstanceExperimentalSettings,
    { previousSettings?: InstanceExperimentalSettingsWithManaged }
  >({
    mutationFn: async (patch: PatchInstanceExperimentalSettings) =>
      instanceSettingsApi.updateExperimental(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.instance.experimentalSettings });
      const previousSettings = queryClient.getQueryData<InstanceExperimentalSettingsWithManaged>(
        queryKeys.instance.experimentalSettings,
      );
      if (previousSettings) {
        queryClient.setQueryData<InstanceExperimentalSettingsWithManaged>(
          queryKeys.instance.experimentalSettings,
          { ...previousSettings, ...patch },
        );
      }
      return { previousSettings };
    },
    onSuccess: async (updatedSettings) => {
      setActionError(null);
      queryClient.setQueryData(queryKeys.instance.experimentalSettings, updatedSettings);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.experimentalSettings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adapters.all }),
        queryClient.invalidateQueries({ queryKey: ["built-in-agents"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.health }),
        queryClient.invalidateQueries({ queryKey: ["apps"] }),
      ]);
    },
    onError: (error, _patch, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(queryKeys.instance.experimentalSettings, context.previousSettings);
      }
      setActionError(error instanceof Error ? error.message : "Failed to update experimental settings.");
    },
  });

  if (experimentalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("pages.instanceExperimental.loading")}</div>;
  }

  if (experimentalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {experimentalQuery.error instanceof Error
          ? experimentalQuery.error.message
          : t("pages.instanceExperimental.loadFailed")}
      </div>
    );
  }

  const inWorktree = isWorktreeRuntime();
  // Present only on cloud-managed instances: keys the managed overlay controls
  // render locked with the "Managed by Paperclip Cloud" badge. Self-hosted
  // responses carry no `managedKeys`, so every card stays editable.
  const managedKeys = experimentalQuery.data?.managedKeys ?? {};
  const enableWorktreeRunExecution = experimentalQuery.data?.enableWorktreeRunExecution === true;
  const worktreeRunExecutionManaged = managedKeys.enableWorktreeRunExecution?.managed === true;
  const worktreeRunExecutionState = resolveWorktreeRunExecutionDisplayState(
    experimentalQuery.data,
    getWorktreeInstanceId(),
  );
  const enableEnvironments = experimentalQuery.data?.enableEnvironments === true;
  const enableNativeRunner = experimentalQuery.data?.enableNativeRunner === true;
  const enableChatConnectors = experimentalQuery.data?.enableChatConnectors === true;
  const enableManagedSandboxOnly = experimentalQuery.data?.enableManagedSandboxOnly === true;
  const enableIsolatedWorkspaces = experimentalQuery.data?.enableIsolatedWorkspaces === true;
  const enableIsolatedWorkspacesByDefault =
    experimentalQuery.data?.enableIsolatedWorkspacesByDefault === true;
  // Streamlined left navigation is now the standard sidebar (PAP-12472); the
  // experimental opt-out was retired, so it no longer surfaces a toggle here.
  const enableStreamlinedUi = experimentalQuery.data?.enableStreamlinedUi !== false;
  const enableConferenceRoomChat = experimentalQuery.data?.enableConferenceRoomChat === true;
  const enableClassicTaskInterface = experimentalQuery.data?.enableClassicTaskInterface === true;
  const enableIssuePlanDecompositions =
    experimentalQuery.data?.enableIssuePlanDecompositions === true;
  const enableExperimentalFileViewer =
    experimentalQuery.data?.enableExperimentalFileViewer === true;
  const enableExternalObjects = experimentalQuery.data?.enableExternalObjects === true;
  const enableBuiltInAgents = experimentalQuery.data?.enableBuiltInAgents === true;
  const enableBetaSkills = experimentalQuery.data?.enableBetaSkills === true;
  const enableSummaries = experimentalQuery.data?.enableSummaries === true;
  const enableStatusCards = experimentalQuery.data?.enableStatusCards === true;
  const summariesManaged = managedKeys.enableSummaries?.managed === true;
  const statusCardsManaged = managedKeys.enableStatusCards?.managed === true;
  const statusCardsBlockedByManagedSummaries = summariesManaged && !enableSummaries;
  const summariesRequiredByManagedStatusCards = statusCardsManaged && enableStatusCards;
  const enableDecisions = experimentalQuery.data?.enableDecisions === true;
  const enableGoalsSidebarLink = experimentalQuery.data?.enableGoalsSidebarLink === true;
  const enableCases = experimentalQuery.data?.enableCases === true;
  const enableServerInfoDebugView = experimentalQuery.data?.enableServerInfoDebugView === true;
  const enablePaperclipDeveloperMode =
    experimentalQuery.data?.enablePaperclipDeveloperMode === true;
  const enableSimplifiedEnglishInteractions =
    experimentalQuery.data?.enableSimplifiedEnglishInteractions === true;
  const enableFirstTaskPlanProposal =
    experimentalQuery.data?.enableFirstTaskPlanProposal === true;
  const enableSmokeLab = experimentalQuery.data?.enableSmokeLab === true;
  const autoRestartDevServerWhenIdle = experimentalQuery.data?.autoRestartDevServerWhenIdle === true;
  const isVisible = (key: InstanceFeatureKey) => !hiddenSettings.has(experimentalSettingKey(key));
  const showWorktreeRunExecution = inWorktree && isVisible("enableWorktreeRunExecution");
  const showDeveloperSection = showWorktreeRunExecution || ([
    "autoRestartDevServerWhenIdle",
    "enableManagedSandboxOnly",
    "enablePaperclipDeveloperMode",
    "enableServerInfoDebugView",
    "enableSmokeLab",
    "enableIssuePlanDecompositions",
  ] satisfies InstanceFeatureKey[]).some(isVisible);
  const showLegacySection = isVisible("enableClassicTaskInterface") || isVisible("enableGoalsSidebarLink");
  return (
    <div className="max-w-6xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("pages.instanceExperimental.title")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("pages.instanceExperimental.description")}
        </p>
      </div>

      <div
        role="alert"
        className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">{t("pages.instanceExperimental.warningTitle")}</p>
            <p className="text-muted-foreground">
{t("pages.instanceExperimental.warningBody")}
            </p>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="space-y-3" aria-labelledby="experimental-features-heading">
        <div className="space-y-1">
          <h2 id="experimental-features-heading" className="text-sm font-semibold">
            {t("pages.instanceExperimental.featuresHeading")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("pages.instanceExperimental.featuresSubheading")}
          </p>
        </div>

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.agentChat")}
          description={t("pages.instanceExperimental.agentChatDescription")}
          footnote={t("pages.instanceExperimental.agentChatFootnote")}
          checked={experimentalQuery.data?.enableAgentChat ?? false}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableAgentChat: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableAgentChat"
          managed={managedKeys.enableAgentChat}
          ariaLabel={t("pages.instanceExperimental.toggleAgentChat")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.betaSkills")}
          description={t("pages.instanceExperimental.betaSkillsDescription")}
          checked={enableBetaSkills}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableBetaSkills: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableBetaSkills"
          managed={managedKeys.enableBetaSkills}
          ariaLabel={t("pages.instanceExperimental.toggleBetaSkills")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.builtInAgents")}
          description={t("pages.instanceExperimental.builtInAgentsDescription")}
          checked={enableBuiltInAgents}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableBuiltInAgents: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableBuiltInAgents"
          managed={managedKeys.enableBuiltInAgents}
          ariaLabel={t("pages.instanceExperimental.toggleBuiltInAgents")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.cases")}
          description={t("pages.instanceExperimental.casesDescription")}
          footnote={t("pages.instanceExperimental.casesFootnote")}
          checked={enableCases}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableCases: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableCases"
          managed={managedKeys.enableCases}
          ariaLabel={t("pages.instanceExperimental.toggleCases")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.chatConnectors")}
          description={t("pages.instanceExperimental.chatConnectorsDescription")}
          footnote={t("pages.instanceExperimental.chatConnectorsFootnote")}
          checked={enableChatConnectors}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableChatConnectors: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableChatConnectors"
          managed={managedKeys.enableChatConnectors}
          ariaLabel={t("pages.instanceExperimental.toggleChatConnectors")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.combinedInboxTasks")}
          description={t("pages.instanceExperimental.combinedInboxTasksDescription")}
          footnote={t("pages.instanceExperimental.combinedInboxTasksFootnote")}
          checked={experimentalQuery.data?.enableCombinedInboxTasks ?? false}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableCombinedInboxTasks: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableCombinedInboxTasks"
          managed={managedKeys.enableCombinedInboxTasks}
          ariaLabel={t("pages.instanceExperimental.toggleCombinedInboxTasks")}
        />

        {SHOW_CONFERENCE_ROOM_EXPERIMENTAL_SETTING ? (
          <ExperimentalToggleCard
            title={t("pages.instanceExperimental.conferenceRoomChat")}
            description={t("pages.instanceExperimental.conferenceRoomChatDescription")}
            checked={enableConferenceRoomChat}
            onCheckedChange={(checked) => toggleMutation.mutate({ enableConferenceRoomChat: checked })}
            disabled={toggleMutation.isPending}
            settingKey="enableConferenceRoomChat"
            managed={managedKeys.enableConferenceRoomChat}
            ariaLabel={t("pages.instanceExperimental.toggleConferenceRoomChat")}
          />
        ) : null}

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.decisions")}
          description={t("pages.instanceExperimental.decisionsDescription")}
          checked={enableDecisions}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableDecisions: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableDecisions"
          managed={managedKeys.enableDecisions}
          ariaLabel={t("pages.instanceExperimental.toggleDecisions")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.enableEnvironments")}
          description={t("pages.instanceExperimental.enableEnvironmentsDescription")}
          checked={enableEnvironments}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableEnvironments: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableEnvironments"
          managed={managedKeys.enableEnvironments}
          ariaLabel={t("pages.instanceExperimental.toggleEnvironments")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.enableExternalObjects")}
          description={t("pages.instanceExperimental.enableExternalObjectsDescription")}
          checked={enableExternalObjects}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableExternalObjects: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableExternalObjects"
          managed={managedKeys.enableExternalObjects}
          ariaLabel={t("pages.instanceExperimental.toggleExternalObjects")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.enableIsolatedWorkspaces")}
          description={t("pages.instanceExperimental.enableIsolatedWorkspacesDescription")}
          checked={enableIsolatedWorkspaces}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableIsolatedWorkspaces: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableIsolatedWorkspaces"
          managed={managedKeys.enableIsolatedWorkspaces}
          ariaLabel={t("pages.instanceExperimental.toggleIsolatedWorkspaces")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.experimentalFileViewer")}
          description={t("pages.instanceExperimental.experimentalFileViewerDescription")}
          checked={enableExperimentalFileViewer}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableExperimentalFileViewer: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableExperimentalFileViewer"
          managed={managedKeys.enableExperimentalFileViewer}
          ariaLabel={t("pages.instanceExperimental.toggleExperimentalFileViewer")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.firstTaskPlanProposal")}
          description={t("pages.instanceExperimental.firstTaskPlanProposalDescription")}
          checked={enableFirstTaskPlanProposal}
          onCheckedChange={(checked) =>
            toggleMutation.mutate({ enableFirstTaskPlanProposal: checked })
          }
          disabled={toggleMutation.isPending}
          settingKey="enableFirstTaskPlanProposal"
          managed={managedKeys.enableFirstTaskPlanProposal}
          ariaLabel={t("pages.instanceExperimental.toggleFirstTaskPlanProposal")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.memoryConnectors")}
          description={t("pages.instanceExperimental.memoryConnectorsDescription")}
          footnote={t("pages.instanceExperimental.memoryConnectorsFootnote")}
          checked={experimentalQuery.data?.enableMemoryConnectors === true}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableMemoryConnectors: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableMemoryConnectors"
          managed={managedKeys.enableMemoryConnectors}
          ariaLabel={t("pages.instanceExperimental.toggleMemoryConnectors")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.paperclipRunner")}
          description={t("pages.instanceExperimental.paperclipRunnerDescription")}
          checked={enableNativeRunner}
          onCheckedChange={(checked) =>
            toggleMutation.mutate({ enableNativeRunner: checked })
          }
          disabled={toggleMutation.isPending}
          settingKey="enableNativeRunner"
          managed={managedKeys.enableNativeRunner}
          ariaLabel={t("pages.instanceExperimental.togglePaperclipRunner")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.simplifiedEnglish")}
          description={t("pages.instanceExperimental.simplifiedEnglishDescription")}
          checked={enableSimplifiedEnglishInteractions}
          onCheckedChange={(checked) =>
            toggleMutation.mutate({ enableSimplifiedEnglishInteractions: checked })
          }
          disabled={toggleMutation.isPending}
          settingKey="enableSimplifiedEnglishInteractions"
          managed={managedKeys.enableSimplifiedEnglishInteractions}
          ariaLabel={t("pages.instanceExperimental.toggleSimplifiedEnglish")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.statusCards")}
          description={t("pages.instanceExperimental.statusCardsDescription")}
          footnote={t("pages.instanceExperimental.statusCardsFootnote")}
          checked={enableStatusCards}
          onCheckedChange={(checked) =>
            toggleMutation.mutate(
              checked
                ? { enableSummaries: true, enableStatusCards: true }
                : { enableStatusCards: false },
            )
          }
          disabled={toggleMutation.isPending || statusCardsBlockedByManagedSummaries}
          settingKey="enableStatusCards"
          managed={managedKeys.enableStatusCards}
          ariaLabel={t("pages.instanceExperimental.toggleStatusCards")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.streamlinedUi")}
          description={t("pages.instanceExperimental.streamlinedUiDescription")}
          footnote={t("pages.instanceExperimental.streamlinedUiFootnote")}
          checked={enableStreamlinedUi}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableStreamlinedUi: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableStreamlinedUi"
          managed={managedKeys.enableStreamlinedUi}
          ariaLabel={t("pages.instanceExperimental.toggleStreamlinedUi")}
        />

        <ExperimentalToggleCard
          title={t("pages.instanceExperimental.summaries")}
          description={t("pages.instanceExperimental.summariesDescription")}
          footnote={t("pages.instanceExperimental.summariesFootnote")}
          checked={enableSummaries}
          onCheckedChange={(checked) =>
            toggleMutation.mutate(
              checked || !enableStatusCards
                ? { enableSummaries: checked }
                : { enableSummaries: false, enableStatusCards: false },
            )
          }
          disabled={toggleMutation.isPending || summariesRequiredByManagedStatusCards}
          settingKey="enableSummaries"
          managed={managedKeys.enableSummaries}
          ariaLabel={t("pages.instanceExperimental.toggleSummaries")}
        />

        {enableIsolatedWorkspaces && (
          <ExperimentalToggleCard
            title={t("pages.instanceExperimental.isolatedWorkspacesByDefault")}
            description={t("pages.instanceExperimental.isolatedWorkspacesByDefaultDescription")}
            checked={enableIsolatedWorkspacesByDefault}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableIsolatedWorkspacesByDefault: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableIsolatedWorkspacesByDefault"
            managed={managedKeys.enableIsolatedWorkspacesByDefault}
            ariaLabel={t("pages.instanceExperimental.toggleIsolatedWorkspacesByDefault")}
          />
        )}
      </section>

      {showDeveloperSection ? (
        <section className="space-y-3" aria-labelledby="developer-mode-heading">
          <div className="space-y-1">
            <h2 id="developer-mode-heading" className="text-sm font-semibold">
              {t("pages.instanceExperimental.developerHeading")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("pages.instanceExperimental.developerSubheading")}
            </p>
          </div>

          <ExperimentalToggleCard
            title={t("pages.instanceExperimental.autoRestartDevServerWhenIdle")}
            description={t("pages.instanceExperimental.autoRestartDevServerWhenIdleDescription")}
            checked={autoRestartDevServerWhenIdle}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ autoRestartDevServerWhenIdle: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="autoRestartDevServerWhenIdle"
            managed={managedKeys.autoRestartDevServerWhenIdle}
            ariaLabel={t("pages.instanceExperimental.toggleAutoRestartDevServer")}
          />

          <ExperimentalToggleCard
            title={t("pages.instanceExperimental.managedEnvironmentOnly")}
            description={t("pages.instanceExperimental.managedEnvironmentOnlyDescription")}
            checked={enableManagedSandboxOnly}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableManagedSandboxOnly: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableManagedSandboxOnly"
            managed={managedKeys.enableManagedSandboxOnly}
            ariaLabel={t("pages.instanceExperimental.toggleManagedEnvironmentOnly")}
          />

          <ExperimentalToggleCard
            title={t("pages.instanceExperimental.paperclipDeveloperMode")}
            description={t("pages.instanceExperimental.paperclipDeveloperModeDescription")}
            checked={enablePaperclipDeveloperMode}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enablePaperclipDeveloperMode: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enablePaperclipDeveloperMode"
            managed={managedKeys.enablePaperclipDeveloperMode}
            ariaLabel={t("pages.instanceExperimental.togglePaperclipDeveloperMode")}
          />

          {showWorktreeRunExecution ? (
            <Card className="block bg-transparent p-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{t("pages.instanceExperimental.worktreeRunTitle")}</h3>
                      {worktreeRunExecutionManaged ? <ManagedByCloudBadge /> : null}
                    </div>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      {t("pages.instanceExperimental.worktreeRunDescription")}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={enableWorktreeRunExecution}
                    onCheckedChange={(checked) => {
                      if (worktreeRunExecutionManaged) return;
                      toggleMutation.mutate({ enableWorktreeRunExecution: checked });
                    }}
                    disabled={toggleMutation.isPending || worktreeRunExecutionManaged}
                    aria-label={t("pages.instanceExperimental.toggleWorktreeRunExecution")}
                  />
                </div>

                {worktreeRunExecutionState.kind === "armed" ? (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-foreground">
                    <Play className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>
                      {t("pages.instanceExperimental.worktreeRunArmed", {
                        time: formatActivationTimestamp(worktreeRunExecutionState.activatedAt),
                      })}
                    </span>
                  </div>
                ) : null}

                {worktreeRunExecutionState.kind === "fail_closed" ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">{t("pages.instanceExperimental.worktreeRunSuppressedTitle")}</p>
                      <p className="text-muted-foreground">
                        {worktreeRunExecutionState.reason === "instance_mismatch"
                          ? t("pages.instanceExperimental.worktreeRunSuppressedMismatch")
                          : t("pages.instanceExperimental.worktreeRunSuppressedMissing")}{" "}
                        {t("pages.instanceExperimental.worktreeRunSuppressedHint")}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <ExperimentalToggleCard
            title={t("pages.instanceExperimental.serverInfoDebugView")}
            description={t("pages.instanceExperimental.serverInfoDebugViewDescription")}
            checked={enableServerInfoDebugView}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableServerInfoDebugView: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableServerInfoDebugView"
            managed={managedKeys.enableServerInfoDebugView}
            ariaLabel={t("pages.instanceExperimental.toggleServerInfoDebugView")}
          />

          <ExperimentalToggleCard
            title={t("pages.instanceExperimental.smokeLab")}
            description={t("pages.instanceExperimental.smokeLabDescription")}
            checked={enableSmokeLab}
            onCheckedChange={(checked) => toggleMutation.mutate({ enableSmokeLab: checked })}
            disabled={toggleMutation.isPending}
            settingKey="enableSmokeLab"
            managed={managedKeys.enableSmokeLab}
            ariaLabel={t("pages.instanceExperimental.toggleSmokeLab")}
          />

          <ExperimentalToggleCard
            title={t("pages.instanceExperimental.issuePlanDecompositions")}
            description={t("pages.instanceExperimental.issuePlanDecompositionsDescription")}
            checked={enableIssuePlanDecompositions}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableIssuePlanDecompositions: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableIssuePlanDecompositions"
            managed={managedKeys.enableIssuePlanDecompositions}
            ariaLabel={t("pages.instanceExperimental.toggleIssuePlanDecompositions")}
          />
        </section>
      ) : null}

      {showLegacySection ? (
        <section className="space-y-3" aria-labelledby="legacy-heading">
          <div className="space-y-1">
            <h2 id="legacy-heading" className="text-sm font-semibold">
              {t("pages.instanceExperimental.legacyHeading")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("pages.instanceExperimental.legacySubheading")}</p>
          </div>

          <ExperimentalToggleCard
            title={t("pages.instanceExperimental.classicTaskInterface")}
            description={t("pages.instanceExperimental.classicTaskInterfaceDescription")}
            footnote={t("pages.instanceExperimental.classicTaskInterfaceFootnote")}
            checked={enableClassicTaskInterface}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableClassicTaskInterface: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableClassicTaskInterface"
            managed={managedKeys.enableClassicTaskInterface}
            ariaLabel={t("pages.instanceExperimental.toggleClassicTaskInterface")}
          />

          <ExperimentalToggleCard
            title={t("pages.instanceExperimental.goalsSidebarLink")}
            description={t("pages.instanceExperimental.goalsSidebarLinkDescription")}
            checked={enableGoalsSidebarLink}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableGoalsSidebarLink: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableGoalsSidebarLink"
            managed={managedKeys.enableGoalsSidebarLink}
            ariaLabel={t("pages.instanceExperimental.toggleGoalsSidebarLink")}
          />
        </section>
      ) : null}
    </div>
  );
}
