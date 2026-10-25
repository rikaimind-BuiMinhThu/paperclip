import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workforceApi } from "@/api/workforce";
import { useCompany } from "@/context/CompanyContext";
import { useTranslation } from "@/i18n";
import { queryKeys } from "@/lib/queryKeys";
import { ApprovalCard } from "./ApprovalCard";

export function WorkforceApprovals() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const approvals = useQuery({
    queryKey: queryKeys.workforce.approvals(selectedCompanyId ?? "none"),
    queryFn: () => workforceApi.listApprovals(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approve" | "reject" }) => (
      decision === "approve"
        ? workforceApi.approve(selectedCompanyId!, id)
        : workforceApi.reject(selectedCompanyId!, id)
    ),
    onSuccess: async () => {
      if (!selectedCompanyId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.workforce.approvals(selectedCompanyId) });
    },
  });

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t("workforce.approvalsTitle")}</h1>
      {(approvals.data ?? []).map((approval) => (
        <ApprovalCard
          key={approval.id}
          approval={approval}
          pending={decide.isPending}
          onApprove={() => decide.mutate({ id: approval.id, decision: "approve" })}
          onReject={() => decide.mutate({ id: approval.id, decision: "reject" })}
        />
      ))}
      {approvals.data && approvals.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("workforce.approvalsEmpty")}</p>
      ) : null}
    </div>
  );
}
