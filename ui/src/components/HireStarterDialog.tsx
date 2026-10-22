import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MASTER_AGENT_DEPARTMENTS, type MasterAgentDepartment } from "@paperclipai/shared";
import { accessApi } from "@/api/access";
import { agentsApi } from "@/api/agents";
import { masterAgentsApi } from "@/api/masterAgents";
import { useCompany } from "@/context/CompanyContext";
import { useDialog } from "@/context/DialogContext";
import { useTranslation } from "@/i18n";
import { hiredMasterAgentIds } from "@/lib/hired-master-agents";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  GALLERY_DEPARTMENT_LABEL,
  MasterAgentGallery,
  type GallerySelection,
} from "./onboarding/MasterAgentGallery";

export function HireStarterDialog() {
  const { hireStarterOpen, closeHireStarter } = useDialog();
  const { selectedCompanyId } = useCompany();
  if (!hireStarterOpen || !selectedCompanyId) return null;
  return (
    <HireStarterDialogContent
      key={selectedCompanyId}
      companyId={selectedCompanyId}
      onClose={closeHireStarter}
    />
  );
}

function HireStarterDialogContent({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [department, setDepartment] = useState<MasterAgentDepartment>("leadership");
  const [selection, setSelection] = useState<GallerySelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  const agentsQuery = useQuery({
    queryKey: queryKeys.masterAgents.agents(false),
    queryFn: () => masterAgentsApi.list(false),
  });
  const teamsQuery = useQuery({
    queryKey: queryKeys.masterAgents.teams(false),
    queryFn: () => masterAgentsApi.listTeams(false),
  });
  const defaultModelQuery = useQuery({
    queryKey: queryKeys.masterAgents.defaultModel,
    queryFn: () => masterAgentsApi.defaultModel(),
  });
  const companyAgentsQuery = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
  });
  const boardAccessQuery = useQuery({
    queryKey: queryKeys.access.currentBoardAccess,
    queryFn: () => accessApi.getCurrentBoardAccess(),
  });

  const galleryAgents = useMemo(
    () =>
      (agentsQuery.data ?? []).map((agent) => ({
        id: agent.id,
        title: agent.title,
        description: agent.description,
        icon: agent.icon,
        department: agent.department,
        recommended: agent.recommended,
      })),
    [agentsQuery.data],
  );

  const galleryTeams = useMemo(
    () =>
      (teamsQuery.data ?? [])
        .filter((team) => team.enabled)
        .map((team) => {
          const members = [...team.members].sort((left, right) => left.sortOrder - right.sortOrder);
          return {
            id: team.id,
            name: team.name,
            description: team.description,
            department: team.department,
            memberTitles: members.map((member) => member.title),
            memberIds: members.map((member) => member.masterAgentId),
            managerId: members.find((member) => member.isManager)?.masterAgentId ?? null,
          };
        }),
    [teamsQuery.data],
  );

  const hiredIds = useMemo(
    () => hiredMasterAgentIds(companyAgentsQuery.data ?? [], agentsQuery.data ?? []),
    [companyAgentsQuery.data, agentsQuery.data],
  );

  useEffect(() => {
    if (seeded || galleryAgents.length === 0) return;
    const available = galleryAgents.filter((agent) => !hiredIds.has(agent.id));
    if (available.length === 0) {
      setSeeded(true);
      return;
    }
    const recommended = available.find((agent) => agent.recommended);
    const fallback = MASTER_AGENT_DEPARTMENTS
      .map((dept) => available.find((agent) => agent.department === dept))
      .find((agent) => agent !== undefined);
    const picked = recommended ?? fallback;
    if (!picked) {
      setSeeded(true);
      return;
    }
    setSelection({ kind: "agent", id: picked.id });
    setDepartment(picked.department);
    setSeeded(true);
  }, [galleryAgents, hiredIds, seeded]);

  useEffect(() => {
    if (!selection) return;
    if (selection.kind === "agent" && hiredIds.has(selection.id)) {
      setSelection(null);
      return;
    }
    if (selection.kind === "team") {
      const team = galleryTeams.find((row) => row.id === selection.id);
      if (!team || team.memberIds.some((id) => hiredIds.has(id))) {
        setSelection(null);
      }
    }
  }, [selection, hiredIds, galleryTeams]);

  const hireMutation = useMutation({
    mutationFn: () => {
      if (!selection) throw new Error(t("onboarding.wizard.gallery.empty"));
      return masterAgentsApi.hire(
        companyId,
        selection.kind === "agent"
          ? { masterAgentId: selection.id }
          : { masterTeamId: selection.id },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(companyId) });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t("onboarding.wizard.gallery.hireFailed"));
    },
  });

  const modelConfigured = defaultModelQuery.data?.configured === true;
  const canHire =
    Boolean(selection) &&
    modelConfigured &&
    !hireMutation.isPending &&
    galleryAgents.length > 0;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-(--sz-calc-18) flex-col gap-0 overflow-hidden p-0 sm:max-w-(--sz-640px)"
        showCloseButton
      >
        <DialogHeader className="space-y-1 px-6 pt-6 pr-12 text-left">
          <DialogTitle>{t("onboarding.wizard.steps.gallery.title")}</DialogTitle>
          <DialogDescription>{t("onboarding.wizard.gallery.lede")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <MasterAgentGallery
            agents={galleryAgents}
            teams={galleryTeams}
            department={department}
            onDepartment={setDepartment}
            selection={selection}
            onSelect={(next) => {
              setError(null);
              setSelection(next);
              if (next.kind === "agent") {
                const agent = galleryAgents.find((row) => row.id === next.id);
                if (agent) setDepartment(agent.department);
              } else {
                const team = galleryTeams.find((row) => row.id === next.id);
                if (team) setDepartment(team.department);
              }
            }}
            modelMissing={!defaultModelQuery.isLoading && !modelConfigured}
            isInstanceAdmin={
              boardAccessQuery.data?.isInstanceAdmin === true ||
              boardAccessQuery.data?.source === "local_implicit"
            }
            error={error}
            hiredMasterAgentIds={hiredIds}
          />
          {selection?.kind === "agent" ? (
            <p className="sr-only">
              {t("onboarding.wizard.gallery.selected", {
                name: galleryAgents.find((row) => row.id === selection.id)?.title ?? "",
              })}
            </p>
          ) : null}
          {selection?.kind === "team" ? (
            <p className="sr-only">
              {t("onboarding.wizard.gallery.hireTeam", {
                department: t(GALLERY_DEPARTMENT_LABEL[department]),
              })}
            </p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 border-t border-border px-6 py-4 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!canHire}
            onClick={() => {
              setError(null);
              hireMutation.mutate();
            }}
          >
            {hireMutation.isPending ? t("onboarding.wizard.footer.hiring") : t("common.continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
