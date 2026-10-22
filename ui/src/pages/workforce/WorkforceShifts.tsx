import { useQuery } from "@tanstack/react-query";
import { workforceApi } from "@/api/workforce";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import { Link, useParams } from "@/lib/router";

export function WorkforceShifts() {
  const { shiftId } = useParams<{ shiftId?: string }>();
  const { selectedCompanyId } = useCompany();
  const shifts = useQuery({
    queryKey: queryKeys.workforce.shifts(selectedCompanyId ?? "none"),
    queryFn: () => workforceApi.listShifts(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });
  const detail = useQuery({
    queryKey: queryKeys.workforce.shift(selectedCompanyId ?? "none", shiftId ?? "none"),
    queryFn: () => workforceApi.getShift(selectedCompanyId!, shiftId!),
    enabled: Boolean(selectedCompanyId && shiftId),
  });

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Shifts</h1>
      <div className="flex flex-col gap-2">
        {(shifts.data ?? []).map((shift) => (
          <Link key={shift.id} to={`/workforce/shifts/${shift.id}`} className="text-sm underline">
            {shift.status} · {new Date(shift.startedAt).toLocaleString()} · {shift.costCents} cents
          </Link>
        ))}
      </div>
      {detail.data ? (
        <div className="flex flex-col gap-2 rounded-lg border p-4">
          <h2 className="text-lg font-medium">Shift detail</h2>
          <p className="text-sm">Summary: {detail.data.shift.summary ?? "none"}</p>
          <p className="text-sm">Previous: {detail.data.previous?.summary ?? "none"}</p>
          <p className="text-sm">Cost: {detail.data.shift.costCents} cents</p>
          {(detail.data.run?.steps ?? []).map((step) => (
            <p key={step.id} className="text-sm">{step.nodeId} · {step.status}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
