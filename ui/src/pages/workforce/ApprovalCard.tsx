import type { WorkforceApproval } from "@/api/workforce";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function ApprovalCard({
  approval,
  onApprove,
  onReject,
  pending,
}: {
  approval: WorkforceApproval;
  onApprove?: () => void;
  onReject?: () => void;
  pending?: boolean;
}) {
  const payload = approval.payload;
  return (
    <Card data-testid="workforce-approval-card">
      <CardHeader>
        <CardTitle>{approval.agentName ?? "AI Employee"}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>Tool: {approval.toolName}</p>
        <p>Risk: {approval.risk}</p>
        <p>To: {payload?.to ?? ""}</p>
        <p data-testid="workforce-approval-subject">Subject: {payload?.subject ?? ""}</p>
        <p className="whitespace-pre-wrap">Body: {payload?.body ?? ""}</p>
        {approval.issueId ? <p>Issue: {approval.issueId}</p> : null}
        <p>Expires: {approval.expiresAt ? new Date(approval.expiresAt).toLocaleString() : "none"}</p>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <Button type="button" variant="outline" disabled={pending} onClick={onReject}>Reject</Button>
        <Button type="button" disabled={pending} onClick={onApprove}>Approve</Button>
      </CardFooter>
    </Card>
  );
}
