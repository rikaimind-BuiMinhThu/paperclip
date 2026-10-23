import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AGENT_ROLES,
  DEFAULT_MODEL_ADAPTER_TYPES,
  MASTER_AGENT_DEPARTMENTS,
  MASTER_AGENT_ICONS,
  type DefaultModelAdapterType,
  type MasterAgentDepartment,
  type MasterAgentRecord,
  type MasterTeamRecord,
} from "@paperclipai/shared";
import { accessApi } from "@/api/access";
import { masterAgentsApi } from "@/api/masterAgents";
import { GALLERY_DEPARTMENT_LABEL } from "@/components/onboarding/MasterAgentGallery";
import { MasterAgentIcon } from "@/components/onboarding/master-agent-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useTranslation } from "@/i18n";
import { INSTANCE_SETTINGS_PATH_PREFIX } from "@/lib/instance-settings";
import { queryKeys } from "@/lib/queryKeys";
import { Link } from "@/lib/router";

type AgentDraft = {
  title: string;
  department: MasterAgentDepartment;
  description: string;
  instructions: string;
  role: string;
  icon: string;
  skillKeys: string;
  canCreateAgents: boolean;
  enabled: boolean;
  recommended: boolean;
};

type TeamDraft = {
  name: string;
  department: MasterAgentDepartment;
  description: string;
  enabled: boolean;
  memberIds: string[];
  managerId: string;
};

function agentDraft(agent?: MasterAgentRecord): AgentDraft {
  return {
    title: agent?.title ?? "",
    department: agent?.department ?? "leadership",
    description: agent?.description ?? "",
    instructions: agent?.instructions ?? "",
    role: agent?.role ?? "general",
    icon: agent?.icon ?? "user",
    skillKeys: (agent?.skillKeys ?? []).join("\n"),
    canCreateAgents: agent?.canCreateAgents ?? false,
    enabled: agent?.enabled ?? true,
    recommended: agent?.recommended ?? false,
  };
}

function teamDraft(team: MasterTeamRecord | undefined, department: MasterAgentDepartment): TeamDraft {
  const members = [...(team?.members ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    name: team?.name ?? "",
    department: team?.department ?? department,
    description: team?.description ?? "",
    enabled: team?.enabled ?? true,
    memberIds: members.map((member) => member.masterAgentId),
    managerId: members.find((member) => member.isManager)?.masterAgentId ?? "",
  };
}

function skillList(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function MasterAgents() {
  const { t } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [modelError, setModelError] = useState<string | null>(null);
  const [adapterType, setAdapterType] = useState<DefaultModelAdapterType>("claude_local");
  const [model, setModel] = useState("");
  const [credentialKind, setCredentialKind] = useState<"stored_login" | "api_key">("api_key");
  const [apiKey, setApiKey] = useState("");
  const [editingAgentId, setEditingAgentId] = useState<string | "new" | null>(null);
  const [agentForm, setAgentForm] = useState<AgentDraft>(agentDraft());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingTeamDepartment, setEditingTeamDepartment] = useState<MasterAgentDepartment | null>(null);
  const [teamForm, setTeamForm] = useState<TeamDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: t("settings.masterAgents") }]);
  }, [setBreadcrumbs, t]);

  const boardAccess = useQuery({
    queryKey: queryKeys.access.currentBoardAccess,
    queryFn: () => accessApi.getCurrentBoardAccess(),
    retry: false,
  });
  const canManage =
    Boolean(boardAccess.data?.isInstanceAdmin) ||
    boardAccess.data?.source === "local_implicit";
  const includeDisabled = canManage;
  const accessReady = boardAccess.isSuccess;

  const agentsQuery = useQuery({
    queryKey: queryKeys.masterAgents.agents(includeDisabled),
    queryFn: () => masterAgentsApi.list(includeDisabled),
    enabled: accessReady,
  });
  const teamsQuery = useQuery({
    queryKey: queryKeys.masterAgents.teams(includeDisabled),
    queryFn: () => masterAgentsApi.listTeams(includeDisabled),
    enabled: accessReady,
  });
  const modelQuery = useQuery({
    queryKey: queryKeys.masterAgents.defaultModel,
    queryFn: () => masterAgentsApi.defaultModel(),
  });

  useEffect(() => {
    const status = modelQuery.data;
    if (!status?.configured || !status.adapterType || !status.model) return;
    setAdapterType(status.adapterType);
    setModel(status.model);
    if (status.credentialKind) setCredentialKind(status.credentialKind);
  }, [modelQuery.data]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["master-agents"] }),
      queryClient.invalidateQueries({ queryKey: ["master-teams"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.masterAgents.defaultModel }),
    ]);
  };

  const closeAgentDialog = () => {
    setEditingAgentId(null);
    setConfirmDelete(false);
    setFormError(null);
  };

  const closeTeamDialog = () => {
    setEditingTeamDepartment(null);
    setTeamForm(null);
    setFormError(null);
  };

  const saveModel = useMutation({
    mutationFn: () => masterAgentsApi.putDefaultModel({
      adapterType,
      model,
      credential: credentialKind === "api_key"
        ? { kind: "api_key", apiKey }
        : { kind: "stored_login" },
    }),
    onSuccess: async () => {
      setApiKey("");
      setModelError(null);
      await refresh();
    },
    onError: (error: Error) => setModelError(error.message),
  });

  const saveAgent = useMutation({
    mutationFn: async () => {
      const icon = (MASTER_AGENT_ICONS as readonly string[]).includes(agentForm.icon)
        ? agentForm.icon as (typeof MASTER_AGENT_ICONS)[number]
        : "user" as const;
      const body = {
        title: agentForm.title,
        department: agentForm.department,
        description: agentForm.description,
        instructions: agentForm.instructions,
        role: agentForm.role as MasterAgentRecord["role"],
        icon,
        skillKeys: skillList(agentForm.skillKeys),
        canCreateAgents: agentForm.canCreateAgents,
        enabled: agentForm.enabled,
        recommended: agentForm.recommended,
      };
      if (editingAgentId && editingAgentId !== "new") {
        return masterAgentsApi.update(editingAgentId, body);
      }
      return masterAgentsApi.create(body);
    },
    onSuccess: async () => {
      closeAgentDialog();
      await refresh();
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const deleteAgent = useMutation({
    mutationFn: async () => {
      if (!editingAgentId || editingAgentId === "new") {
        throw new Error("No agent selected");
      }
      await masterAgentsApi.remove(editingAgentId);
    },
    onSuccess: async () => {
      closeAgentDialog();
      setActionError(null);
      await refresh();
    },
    onError: (error: Error) => {
      setConfirmDelete(false);
      setFormError(error.message);
    },
  });

  const patchAgent = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof masterAgentsApi.update>[1] }) =>
      masterAgentsApi.update(id, body),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const saveTeam = useMutation({
    mutationFn: async () => {
      if (!teamForm) throw new Error("No team");
      const existing = (teamsQuery.data ?? []).find((team) => team.department === teamForm.department);
      const body = {
        name: teamForm.name,
        description: teamForm.description,
        department: teamForm.department,
        enabled: teamForm.enabled,
        memberIds: teamForm.memberIds,
        managerId: teamForm.managerId,
      };
      if (existing) return masterAgentsApi.updateTeam(existing.id, body);
      return masterAgentsApi.createTeam(body);
    },
    onSuccess: async () => {
      closeTeamDialog();
      await refresh();
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const agents = agentsQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const modelReady = Boolean(model.trim()) && (credentialKind === "stored_login" || apiKey.trim().length > 0 || modelQuery.data?.credentialKind === credentialKind);
  const agentDialogOpen = editingAgentId !== null;
  const teamDialogOpen = editingTeamDepartment !== null && teamForm !== null;
  const isEditingExistingAgent = Boolean(editingAgentId && editingAgentId !== "new");
  const loadError = agentsQuery.isError || teamsQuery.isError
    ? errorMessage(agentsQuery.error ?? teamsQuery.error)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-lg font-medium">{t("settings.masterAgents")}</h1>

      {!canManage && accessReady ? (
        <p className="text-sm text-muted-foreground">
          {t("settings.masterAgentsPage.readOnlyNotice")}{" "}
          <Link to={`${INSTANCE_SETTINGS_PATH_PREFIX}/access`} className="text-foreground underline">
            {t("settings.masterAgentsPage.openInstanceAccess")}
          </Link>
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t("settings.masterAgentsPage.defaultModel")}</h2>
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <Label htmlFor="default-adapter">{t("settings.masterAgentsPage.adapter")}</Label>
            <select
              id="default-adapter"
              className="h-9 rounded-md border border-border bg-card px-3 text-sm"
              value={adapterType}
              disabled={!canManage}
              onChange={(event) => setAdapterType(event.target.value as DefaultModelAdapterType)}
            >
              {DEFAULT_MODEL_ADAPTER_TYPES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <Label htmlFor="default-model">{t("settings.masterAgentsPage.model")}</Label>
            <Input
              id="default-model"
              value={model}
              disabled={!canManage}
              onChange={(event) => setModel(event.target.value)}
            />
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="credential"
                  checked={credentialKind === "stored_login"}
                  disabled={!canManage}
                  onChange={() => setCredentialKind("stored_login")}
                />
                {t("settings.masterAgentsPage.storedLogin")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="credential"
                  checked={credentialKind === "api_key"}
                  disabled={!canManage}
                  onChange={() => setCredentialKind("api_key")}
                />
                {t("settings.masterAgentsPage.apiKey")}
              </label>
            </div>
            {credentialKind === "api_key" ? (
              <Input
                type="password"
                autoComplete="off"
                placeholder={t("settings.masterAgentsPage.apiKeyPlaceholder")}
                value={apiKey}
                disabled={!canManage}
                onChange={(event) => setApiKey(event.target.value)}
              />
            ) : null}
            {modelError ? <p className="text-xs text-destructive">{modelError}</p> : null}
            {canManage ? (
              <Button
                type="button"
                disabled={!modelReady || saveModel.isPending}
                onClick={() => saveModel.mutate()}
              >
                {t("settings.masterAgentsPage.saveModel")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">{t("settings.masterAgentsPage.agents")}</h2>
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingAgentId("new");
                setAgentForm(agentDraft());
                setConfirmDelete(false);
                setFormError(null);
              }}
            >
              {t("settings.masterAgentsPage.addAgent")}
            </Button>
          ) : null}
        </div>
        {loadError ? <p className="text-xs text-destructive">{t("settings.masterAgentsPage.loadError")}: {loadError}</p> : null}
        {actionError ? <p className="text-xs text-destructive">{actionError}</p> : null}
        {MASTER_AGENT_DEPARTMENTS.map((department) => {
          const rows = agents.filter((agent) => agent.department === department);
          return (
            <div key={department} className="flex flex-col gap-2">
              <h3 className="text-xs text-muted-foreground">{t(GALLERY_DEPARTMENT_LABEL[department])}</h3>
              {rows.map((agent) => (
                <div key={agent.id} className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
                  <MasterAgentIcon name={agent.icon} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{agent.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{agent.description}</p>
                  </div>
                  {canManage ? (
                    <>
                      <ToggleSwitch
                        checked={agent.enabled}
                        aria-label={t("settings.masterAgentsPage.enabled")}
                        onCheckedChange={(enabled) => patchAgent.mutate({ id: agent.id, body: { enabled } })}
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="radio"
                          name="recommended-agent"
                          checked={agent.recommended}
                          onChange={() => patchAgent.mutate({ id: agent.id, body: { recommended: true } })}
                        />
                        {t("settings.masterAgentsPage.recommended")}
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setEditingAgentId(agent.id);
                          setAgentForm(agentDraft(agent));
                          setConfirmDelete(false);
                          setFormError(null);
                        }}
                      >
                        {t("settings.masterAgentsPage.edit")}
                      </Button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">{t("settings.masterAgentsPage.teams")}</h2>
        {MASTER_AGENT_DEPARTMENTS.filter((department) => department !== "leadership").map((department) => {
          const team = teams.find((row) => row.department === department);
          const summary = team?.members.map((member) => member.title).join(", ") ?? t("settings.masterAgentsPage.noTeam");
          return (
            <div key={department} className="flex items-center gap-3 rounded-md border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{team?.name ?? t(GALLERY_DEPARTMENT_LABEL[department])}</p>
                <p className="truncate text-xs text-muted-foreground">{summary}</p>
              </div>
              {canManage && team ? (
                <ToggleSwitch
                  checked={team.enabled}
                  aria-label={t("settings.masterAgentsPage.enabled")}
                  onCheckedChange={(enabled) => {
                    void masterAgentsApi.updateTeam(team.id, { enabled })
                      .then(async () => {
                        setActionError(null);
                        await refresh();
                      })
                      .catch((error: unknown) => setActionError(errorMessage(error)));
                  }}
                />
              ) : null}
              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingTeamDepartment(department);
                    setTeamForm(teamDraft(team, department));
                    setFormError(null);
                  }}
                >
                  {t("settings.masterAgentsPage.edit")}
                </Button>
              ) : null}
            </div>
          );
        })}
      </section>

      <Dialog
        open={agentDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeAgentDialog();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditingExistingAgent
                ? t("settings.masterAgentsPage.editAgent")
                : t("settings.masterAgentsPage.addAgent")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isEditingExistingAgent
                ? t("settings.masterAgentsPage.editAgent")
                : t("settings.masterAgentsPage.addAgent")}
            </DialogDescription>
          </DialogHeader>
          {confirmDelete ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{t("settings.masterAgentsPage.deleteAgentConfirm")}</p>
              {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteAgent.isPending}
                  onClick={() => deleteAgent.mutate()}
                >
                  {t("common.delete")}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Label htmlFor="agent-title">{t("settings.masterAgentsPage.titleField")}</Label>
              <Input
                id="agent-title"
                value={agentForm.title}
                onChange={(event) => setAgentForm({ ...agentForm, title: event.target.value })}
              />
              <Label htmlFor="agent-department">{t("settings.masterAgentsPage.department")}</Label>
              <select
                id="agent-department"
                className="h-9 rounded-md border border-border bg-card px-3 text-sm"
                value={agentForm.department}
                onChange={(event) => setAgentForm({ ...agentForm, department: event.target.value as MasterAgentDepartment })}
              >
                {MASTER_AGENT_DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>{t(GALLERY_DEPARTMENT_LABEL[department])}</option>
                ))}
              </select>
              <Label htmlFor="agent-description">{t("settings.masterAgentsPage.description")}</Label>
              <Input
                id="agent-description"
                value={agentForm.description}
                onChange={(event) => setAgentForm({ ...agentForm, description: event.target.value })}
              />
              <Label htmlFor="agent-instructions">{t("settings.masterAgentsPage.instructions")}</Label>
              <Textarea
                id="agent-instructions"
                value={agentForm.instructions}
                onChange={(event) => setAgentForm({ ...agentForm, instructions: event.target.value })}
              />
              <Label htmlFor="agent-role">{t("settings.masterAgentsPage.role")}</Label>
              <select
                id="agent-role"
                className="h-9 rounded-md border border-border bg-card px-3 text-sm"
                value={agentForm.role}
                onChange={(event) => setAgentForm({ ...agentForm, role: event.target.value })}
              >
                {AGENT_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <Label htmlFor="agent-icon">{t("settings.masterAgentsPage.icon")}</Label>
              <select
                id="agent-icon"
                className="h-9 rounded-md border border-border bg-card px-3 text-sm"
                value={agentForm.icon}
                onChange={(event) => setAgentForm({ ...agentForm, icon: event.target.value })}
              >
                {MASTER_AGENT_ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
              </select>
              <Label htmlFor="agent-skills">{t("settings.masterAgentsPage.skills")}</Label>
              <Textarea
                id="agent-skills"
                value={agentForm.skillKeys}
                onChange={(event) => setAgentForm({ ...agentForm, skillKeys: event.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={agentForm.canCreateAgents}
                  onChange={(event) => setAgentForm({ ...agentForm, canCreateAgents: event.target.checked })}
                />
                {t("settings.masterAgentsPage.canHire")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={agentForm.enabled}
                  onChange={(event) => setAgentForm({ ...agentForm, enabled: event.target.checked })}
                />
                {t("settings.masterAgentsPage.enabled")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={agentForm.recommended}
                  onChange={(event) => setAgentForm({ ...agentForm, recommended: event.target.checked })}
                />
                {t("settings.masterAgentsPage.recommended")}
              </label>
              {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
              <DialogFooter className="gap-2 sm:justify-between">
                {isEditingExistingAgent ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      setConfirmDelete(true);
                      setFormError(null);
                    }}
                  >
                    {t("common.delete")}
                  </Button>
                ) : <span />}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={closeAgentDialog}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    disabled={!agentForm.title.trim() || !agentForm.description.trim() || !agentForm.instructions.trim() || saveAgent.isPending}
                    onClick={() => saveAgent.mutate()}
                  >
                    {t("settings.masterAgentsPage.save")}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={teamDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeTeamDialog();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("settings.masterAgentsPage.editTeam")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("settings.masterAgentsPage.editTeam")}
            </DialogDescription>
          </DialogHeader>
          {teamForm ? (
            <div className="flex flex-col gap-3">
              <Label htmlFor="team-name">{t("settings.masterAgentsPage.teamName")}</Label>
              <Input
                id="team-name"
                value={teamForm.name}
                onChange={(event) => setTeamForm({ ...teamForm, name: event.target.value })}
              />
              <Label htmlFor="team-description">{t("settings.masterAgentsPage.description")}</Label>
              <Input
                id="team-description"
                value={teamForm.description}
                onChange={(event) => setTeamForm({ ...teamForm, description: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">{t("settings.masterAgentsPage.members")}</p>
              {agents.filter((agent) => agent.department === teamForm.department).map((agent) => {
                const checked = teamForm.memberIds.includes(agent.id);
                return (
                  <label key={agent.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const memberIds = event.target.checked
                          ? [...teamForm.memberIds, agent.id]
                          : teamForm.memberIds.filter((id) => id !== agent.id);
                        const managerId = memberIds.includes(teamForm.managerId) ? teamForm.managerId : memberIds[0] ?? "";
                        setTeamForm({ ...teamForm, memberIds, managerId });
                      }}
                    />
                    <input
                      type="radio"
                      name={`manager-${teamForm.department}`}
                      checked={teamForm.managerId === agent.id}
                      disabled={!checked}
                      onChange={() => setTeamForm({ ...teamForm, managerId: agent.id })}
                    />
                    {agent.title}
                  </label>
                );
              })}
              {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeTeamDialog}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={!teamForm.name.trim() || !teamForm.description.trim() || teamForm.memberIds.length === 0 || !teamForm.managerId || saveTeam.isPending}
                  onClick={() => saveTeam.mutate()}
                >
                  {t("settings.masterAgentsPage.save")}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
