import { useTranslation } from "@/i18n";

/** Token-built org-chart mock for the hero — no external imagery. */
export function OrgChartVisual() {
  const { t } = useTranslation();

  const nodes = [
    { role: t("landing.visual.ceo"), runtime: "Hermes", tone: "primary" as const },
    { role: t("landing.visual.cto"), runtime: "Codex", tone: "accent" as const },
    { role: t("landing.visual.cmo"), runtime: "OpenClaw", tone: "accent" as const },
    { role: t("landing.visual.frontend"), runtime: "Cursor", tone: "muted" as const },
    { role: t("landing.visual.backend"), runtime: "Claude", tone: "muted" as const },
    { role: t("landing.visual.ops"), runtime: "Claude", tone: "muted" as const },
  ];

  return (
    <div
      className="landing-hero-visual relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm"
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-0 landing-hero-glow opacity-80" />
      <div className="relative grid gap-3">
        <div className="flex justify-center">
          <AgentChip role={nodes[0]!.role} runtime={nodes[0]!.runtime} tone={nodes[0]!.tone} />
        </div>
        <div className="mx-auto h-6 w-px bg-border" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {nodes.slice(1).map((node) => (
            <AgentChip key={node.role} role={node.role} runtime={node.runtime} tone={node.tone} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentChip({
  role,
  runtime,
  tone,
}: {
  role: string;
  runtime: string;
  tone: "primary" | "accent" | "muted";
}) {
  const toneClass =
    tone === "primary"
      ? "border-primary/40 bg-primary/10"
      : tone === "accent"
        ? "border-border bg-secondary"
        : "border-border bg-muted";

  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <p className="text-sm font-medium text-foreground">{role}</p>
      <p className="text-xs text-muted-foreground">{runtime}</p>
    </div>
  );
}
