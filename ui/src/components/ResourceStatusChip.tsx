import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { brandChipBadge, type BrandChipColor } from "@/lib/status-colors";
import { t as i18nT } from "@/i18n";

/**
 * The load-bearing visual grammar for the built-in bundle status panel
 * (Reflection Coach — [PAP-13099], ux-spec §4). Each variant double-encodes
 * state as glyph + word + color so it never relies on color alone
 * (WCAG 1.4.1). Colors route through the shared `brandChipBadge` families — no
 * bespoke tints are minted here (ux-spec §10).
 *
 * A single resource shows at most one readiness chip and at most one drift
 * chip; when both a readiness problem and a drift state coexist, the caller
 * suppresses the drift chip until readiness is `ready` (ux-spec §4).
 */
export type ResourceStatusVariant =
  | "ready"
  | "needs_setup"
  | "missing"
  | "error"
  | "update_available"
  | "drifted"
  | "schedule_off"
  | "schedule_on"
  | "pending_approval"
  | "proposal_pending";

interface VariantSpec {
  color: BrandChipColor;
  glyph: string;
  label: string;
  title: string;
}

const VARIANTS: Record<ResourceStatusVariant, VariantSpec> = {
  ready: { color: "green", glyph: "●", label: i18nT("pages.instanceGeneral.ready"), title: i18nT("scan.s0742") },
  needs_setup: { color: "amber", glyph: "⚠", label: i18nT("scan.s0772"), title: i18nT("scan.s0979") },
  missing: { color: "amber", glyph: "⚠", label: i18nT("pages.secrets.coverage.missing"), title: i18nT("scan.s0483") },
  error: { color: "red", glyph: "✕", label: i18nT("status.error"), title: i18nT("scan.s0500") },
  update_available: {
    color: "blue",
    glyph: "↑",
    label: i18nT("scan.s1421"),
    title: i18nT("scan.s1408"),
  },
  drifted: {
    color: "gray",
    glyph: "✎",
    label: i18nT("scan.s0434"),
    title: i18nT("scan.s1539"),
  },
  schedule_off: {
    color: "gray",
    glyph: "◌",
    label: i18nT("scan.s1184"),
    title: i18nT("scan.s0787"),
  },
  schedule_on: { color: "green", glyph: "●", label: i18nT("pages.instanceGeneral.retentionWeekly"), title: i18nT("scan.s1165") },
  pending_approval: {
    color: "amber",
    glyph: "⚠",
    label: i18nT("status.pendingApproval"),
    title: i18nT("scan.s1461"),
  },
  proposal_pending: {
    color: "blue",
    glyph: "↑",
    label: i18nT("scan.s1001"),
    title: i18nT("scan.s0002"),
  },
};

export function ResourceStatusChip({
  variant,
  label,
  compact = false,
  className,
}: {
  variant: ResourceStatusVariant;
  /** Override the default label (e.g. "Weekly · Mon 09:00 UTC"). */
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const spec = VARIANTS[variant];
  return (
    <Badge
      variant="outline"
      className={cn(
        brandChipBadge[spec.color],
        "font-medium",
        compact && "px-1.5 py-0 text-(length:--text-nano)",
        className,
      )}
      title={spec.title}
    >
      <span aria-hidden="true">{spec.glyph}</span>
      {label ?? spec.label}
    </Badge>
  );
}
