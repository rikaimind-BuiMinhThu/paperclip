import { AgentAvatar } from "@/components/AgentAvatar";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import { useLayoutEffect, useRef, useState } from "react";

type NodeKey = "cmo" | "content-writer" | "video-editor" | "social-media-manager";
type Tone = "primary" | "accent" | "muted";

const NODE_ORDER = [
  "cmo",
  "content-writer",
  "video-editor",
  "social-media-manager",
] as const satisfies readonly NodeKey[];

const NODE_META: Record<
  NodeKey,
  {
    runtime: string;
    tone: Tone;
    busy?: boolean;
  }
> = {
  cmo: {
    runtime: "OpenClaw",
    tone: "primary",
    busy: true,
  },
  "content-writer": {
    runtime: "Claude",
    tone: "accent",
    busy: true,
  },
  "video-editor": {
    runtime: "Codex",
    tone: "muted",
  },
  "social-media-manager": {
    runtime: "Cursor",
    tone: "accent",
    busy: true,
  },
};

type ChipBox = {
  centerX: number;
  top: number;
  bottom: number;
};

type LayoutSize = { width: number; height: number };

type SampleEdgeDef = {
  id: string;
  parent: NodeKey;
  child: NodeKey;
  up?: boolean;
  downPacket?: { id: string; labelKey: "packetBrief" | "packetAssets"; delay: string };
  upPacket?: { id: string; labelKey: "packetReview"; delay: string };
};

/** Marketing-team hierarchy: CMO → writing, video, social. */
const SAMPLE_EDGE_DEFS: SampleEdgeDef[] = [
  {
    id: "cmo-content-writer",
    parent: "cmo",
    child: "content-writer",
    downPacket: { id: "brief-writer", labelKey: "packetBrief", delay: "0s" },
  },
  {
    id: "cmo-video-editor",
    parent: "cmo",
    child: "video-editor",
    up: true,
    downPacket: { id: "assets-video", labelKey: "packetAssets", delay: "0.35s" },
    upPacket: { id: "review-video", labelKey: "packetReview", delay: "0.8s" },
  },
  {
    id: "cmo-social-media-manager",
    parent: "cmo",
    child: "social-media-manager",
    downPacket: { id: "brief-social", labelKey: "packetBrief", delay: "0.55s" },
  },
];

/** Orthogonal path: down from parent, across, then down to child. */
function elbowPath(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
}

function packetPointOnEdge(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  t: number,
): { x: number; y: number } {
  const midY = (y1 + y2) / 2;
  const clamped = Math.min(1, Math.max(0, t));
  const leg1 = Math.abs(midY - y1);
  const leg2 = Math.abs(x2 - x1);
  const leg3 = Math.abs(y2 - midY);
  const total = leg1 + leg2 + leg3 || 1;
  let dist = clamped * total;
  if (dist <= leg1) {
    const u = leg1 === 0 ? 0 : dist / leg1;
    return { x: x1, y: y1 + (midY - y1) * u };
  }
  dist -= leg1;
  if (dist <= leg2) {
    const u = leg2 === 0 ? 0 : dist / leg2;
    return { x: x1 + (x2 - x1) * u, y: midY };
  }
  dist -= leg2;
  const u = leg3 === 0 ? 0 : dist / leg3;
  return { x: x2, y: midY + (y2 - midY) * u };
}

function measureChip(container: DOMRect, el: HTMLElement | null): ChipBox | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    centerX: rect.left - container.left + rect.width / 2,
    top: rect.top - container.top,
    bottom: rect.bottom - container.top,
  };
}

/** Token-built marketing-team org chart for the hero with public agent avatars + work-flow sample. */
export function OrgChartVisual() {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const orgRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Partial<Record<NodeKey, HTMLDivElement | null>>>({});
  const [boxes, setBoxes] = useState<Partial<Record<NodeKey, ChipBox>>>({});
  const [size, setSize] = useState<LayoutSize>({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const org = orgRef.current;
    if (!org) return;

    const update = () => {
      const containerRect = org.getBoundingClientRect();
      setSize({ width: containerRect.width, height: containerRect.height });
      const next: Partial<Record<NodeKey, ChipBox>> = {};
      for (const key of NODE_ORDER) {
        const box = measureChip(containerRect, chipRefs.current[key] ?? null);
        if (box) next[key] = box;
      }
      setBoxes(next);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(org);
    for (const key of NODE_ORDER) {
      const el = chipRefs.current[key];
      if (el) observer.observe(el);
    }
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const nodes = NODE_ORDER.map((key) => ({
    key,
    role: t(`landing.visual.${key}`),
    ...NODE_META[key],
  }));

  const byKey = Object.fromEntries(nodes.map((node) => [node.key, node])) as Record<
    NodeKey,
    (typeof nodes)[number]
  >;

  const edgesReady =
    size.width > 0 &&
    size.height > 0 &&
    SAMPLE_EDGE_DEFS.every((edge) => boxes[edge.parent] && boxes[edge.child]);

  return (
    <div
      className="landing-hero-visual relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm"
      aria-hidden="true"
      data-testid="landing-org-chart-visual"
    >
      <div className="pointer-events-none absolute inset-0 landing-hero-glow opacity-80" />

      <p className="relative z-10 mb-3 text-center text-xs font-medium text-muted-foreground">
        {t("landing.visual.campaign")}
      </p>

      <div ref={orgRef} className="landing-hero-org relative isolate">
        {edgesReady ? (
          <svg
            className="pointer-events-none absolute inset-0 z-0 h-full w-full"
            viewBox={`0 0 ${size.width} ${size.height}`}
            preserveAspectRatio="none"
            data-testid="landing-org-work-flow"
          >
            {SAMPLE_EDGE_DEFS.map((edge) => {
              const parent = boxes[edge.parent]!;
              const child = boxes[edge.child]!;
              const x1 = parent.centerX;
              const y1 = parent.bottom;
              const x2 = child.centerX;
              const y2 = child.top;
              const path = elbowPath(x1, y1, x2, y2);
              return (
                <g key={edge.id}>
                  <path d={path} fill="none" stroke="var(--border)" strokeWidth={1.5} />
                  <path
                    d={path}
                    fill="none"
                    className="org-work-flow-edge"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    data-testid={`landing-org-work-flow-edge-${edge.id}`}
                  />
                  {edge.up ? (
                    <path
                      d={path}
                      fill="none"
                      className="org-work-flow-edge-up"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      data-testid={`landing-org-work-flow-edge-up-${edge.id}`}
                    />
                  ) : null}
                  {edge.downPacket ? (
                    <SamplePacket
                      id={edge.downPacket.id}
                      path={path}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      direction="down"
                      delay={edge.downPacket.delay}
                      label={t(`landing.visual.${edge.downPacket.labelKey}`)}
                      reducedMotion={reducedMotion}
                    />
                  ) : null}
                  {edge.upPacket ? (
                    <SamplePacket
                      id={edge.upPacket.id}
                      path={path}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      direction="up"
                      delay={edge.upPacket.delay}
                      label={t(`landing.visual.${edge.upPacket.labelKey}`)}
                      reducedMotion={reducedMotion}
                    />
                  ) : null}
                </g>
              );
            })}
          </svg>
        ) : null}

        <div className="relative z-10 grid gap-8">
          <div className="flex justify-center">
            <AgentChip
              node={byKey.cmo}
              chipRef={(el) => {
                chipRefs.current.cmo = el;
              }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <AgentChip
              node={byKey["content-writer"]}
              chipRef={(el) => {
                chipRefs.current["content-writer"] = el;
              }}
            />
            <AgentChip
              node={byKey["video-editor"]}
              chipRef={(el) => {
                chipRefs.current["video-editor"] = el;
              }}
            />
            <AgentChip
              node={byKey["social-media-manager"]}
              chipRef={(el) => {
                chipRefs.current["social-media-manager"] = el;
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentChip({
  node,
  chipRef,
}: {
  node: {
    key: NodeKey;
    role: string;
    runtime: string;
    tone: Tone;
    busy?: boolean;
  };
  chipRef: (el: HTMLDivElement | null) => void;
}) {
  const toneClass =
    node.tone === "primary"
      ? "border-primary/40 bg-primary/10"
      : node.tone === "accent"
        ? "border-border bg-secondary"
        : "border-border bg-muted";

  return (
    <div
      ref={chipRef}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2",
        toneClass,
        node.busy && "org-work-flow-pulse",
      )}
      data-testid={`landing-agent-chip-${node.key}`}
    >
      <AgentAvatar
        agent={{
          id: node.key,
          name: node.role,
        }}
        size={32}
        pose={node.busy ? "working" : "rest"}
        className="shrink-0"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{node.role}</p>
        <p className="truncate text-xs text-muted-foreground">{node.runtime}</p>
      </div>
    </div>
  );
}

function SamplePacket({
  id,
  path,
  x1,
  y1,
  x2,
  y2,
  direction,
  delay,
  label,
  reducedMotion,
}: {
  id: string;
  path: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  direction: "down" | "up";
  delay: string;
  label: string;
  reducedMotion: boolean;
}) {
  const className = cn(
    "org-work-flow-packet",
    direction === "down"
      ? "org-work-flow-packet-down org-work-flow-packet-glow"
      : "org-work-flow-packet-up org-work-flow-packet-review",
  );
  const testId = `landing-org-work-flow-packet-${id}-${direction}`;

  if (reducedMotion) {
    const point = packetPointOnEdge(x1, y1, x2, y2, direction === "down" ? 0.4 : 0.65);
    return (
      <rect
        data-testid={testId}
        className={className}
        x={point.x - 4}
        y={point.y - 2}
        width={8}
        height={4}
        rx={2}
      >
        <title>{label}</title>
      </rect>
    );
  }

  return (
    <g data-testid={testId}>
      <title>{label}</title>
      <animateMotion
        path={path}
        dur={direction === "up" ? "2s" : "2.4s"}
        begin={delay}
        repeatCount="indefinite"
        keyPoints={direction === "up" ? "1;0" : "0;1"}
        keyTimes="0;1"
        calcMode="linear"
      />
      <rect className={className} x={-4} y={-2} width={8} height={4} rx={2} />
    </g>
  );
}
