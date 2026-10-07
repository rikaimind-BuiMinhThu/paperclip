import { cn, formatCents, formatTokens } from "@/lib/utils";

function Meter({
  label,
  used,
  limit,
  format,
  warn,
  blocked,
}: {
  label: string;
  used: number;
  limit: number | null;
  format: (n: number) => string;
  warn?: boolean;
  blocked?: boolean;
}) {
  const pct =
    limit != null && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">
          {format(used)}
          {limit != null ? ` / ${format(limit)}` : ""}
        </span>
      </div>
      {limit != null ? (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width]",
              blocked ? "bg-destructive" : warn ? "bg-amber-500" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function UsageMeters({
  tokensUsed,
  tokenLimit,
  costCentsUsed,
  costCentsLimit,
  unitSpendCentsUsed,
  unitSpendCapCents,
  warnToken,
  warnCost,
  llmBlocked,
  unitBlocked,
}: {
  tokensUsed: number;
  tokenLimit: number;
  costCentsUsed: number;
  costCentsLimit: number;
  unitSpendCentsUsed?: number;
  unitSpendCapCents?: number | null;
  warnToken?: boolean;
  warnCost?: boolean;
  llmBlocked?: boolean;
  unitBlocked?: boolean;
}) {
  return (
    <div className="space-y-3">
      <Meter
        label="Tokens"
        used={tokensUsed}
        limit={tokenLimit}
        format={formatTokens}
        warn={warnToken}
        blocked={llmBlocked}
      />
      <Meter
        label="LLM cost"
        used={costCentsUsed}
        limit={costCentsLimit}
        format={formatCents}
        warn={warnCost}
        blocked={llmBlocked}
      />
      {unitSpendCapCents != null || (unitSpendCentsUsed ?? 0) > 0 ? (
        <Meter
          label="Unit spend"
          used={unitSpendCentsUsed ?? 0}
          limit={unitSpendCapCents ?? null}
          format={formatCents}
          blocked={unitBlocked}
        />
      ) : null}
    </div>
  );
}
