import { useEffect, useRef, useState } from "react";
import { resolveAgentAppearance, type AgentAppearance } from "@paperclipai/shared";
import { cn } from "@/lib/utils";
import { AgentAvatar } from "../AgentAvatar";
import type { createCharacter } from "@paperclipai/shared/cliplab/runtime";
import type { Definition } from "@paperclipai/shared/cliplab/model";
import { colorOnboardingDefinition, resolveOnboardingSequences, sequenceDuration, sequenceLeadIn, type OnboardingSequences } from "./onboarding-character";

type Player = ReturnType<typeof createCharacter>;
type Phase = "asleep" | "awake";

export interface OnboardingCharacterProps {
  appearance: AgentAppearance;
  /** Review is the first step where an agent exists; that is where it wakes. */
  awake: boolean;
  className?: string;
}

/**
 * The onboarding hero. photo-v1 uses a still headshot (muted → color). Legacy
 * cap-v1 keeps the ClipLab sleepy → wink → idle arc.
 */
export function OnboardingCharacter({ appearance, awake, className }: OnboardingCharacterProps) {
  const identity = resolveAgentAppearance(appearance);
  if (identity.characterVersion === "photo-v1") {
    return <PhotoOnboardingCharacter appearance={identity} awake={awake} className={className} />;
  }
  return <CapOnboardingCharacter appearance={identity} awake={awake} className={className} />;
}

function PhotoOnboardingCharacter({ appearance, awake, className }: OnboardingCharacterProps) {
  return (
    <span className={cn("relative inline-block", className)} aria-hidden="true">
      <AgentAvatar
        appearance={appearance}
        size={256}
        pose="rest"
        muted={!awake}
        className={cn("size-full transition-[filter,opacity] duration-500", !awake && "grayscale")}
      />
    </span>
  );
}

function CapOnboardingCharacter({ appearance, awake, className }: OnboardingCharacterProps) {
  const identity = resolveAgentAppearance(appearance);
  const base = useRef<HTMLSpanElement>(null), overlay = useRef<HTMLSpanElement>(null);
  const players = useRef<{ base: Player | null; overlay: Player | null }>({ base: null, overlay: null });
  const library = useRef<{ create: typeof createCharacter; definition: Definition; sequences: OnboardingSequences } | null>(null);
  const phase = useRef<Phase>(awake ? "awake" : "asleep");
  const renderedPalette = useRef<string | null>(null);
  const timers = useRef<number[]>([]);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false), [colored, setColored] = useState(awake);
  const [wakeSeconds, setWakeSeconds] = useState(0);

  const clearTimers = () => { for (const id of timers.current) window.clearTimeout(id); timers.current = []; };
  const destroy = (key: "base" | "overlay") => { players.current[key]?.destroy(); players.current[key] = null; };
  const fail = () => { clearTimers(); destroy("overlay"); destroy("base"); setReady(false); setFailed(true); };
  const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FOLLOW = { followCursor: false, followRotation: true, trackingScope: "page" as const, displaySize: 160 };

  function mount(next: Phase) {
    const lib = library.current;
    if (!lib || !base.current || !overlay.current) return;
    clearTimers(); destroy("overlay"); destroy("base");
    const animation = next === "asleep" ? lib.sequences.asleep : lib.sequences.awake;
    const leadIn = sequenceLeadIn(lib.definition, animation);
    const player = lib.create(base.current, colorOnboardingDefinition(lib.definition, identity, next === "asleep"), { animation, ...FOLLOW, onError: fail });
    players.current.base = player;
    player.seek(leadIn);
    if (players.current.base !== player) return;
    if (next === "asleep") {
      const twin = lib.create(overlay.current, colorOnboardingDefinition(lib.definition, identity, false), { animation, ...FOLLOW, onError: fail });
      players.current.overlay = twin;
      twin.seek(leadIn);
      if (players.current.overlay !== twin) return;
    }
    phase.current = next; renderedPalette.current = identity.paletteId; setColored(next === "awake");
  }

  function wake() {
    const lib = library.current, gray = players.current.base, twin = players.current.overlay;
    if (!lib || !gray || !twin || reducedMotion()) { mount("awake"); return; }
    clearTimers();
    const leadIn = sequenceLeadIn(lib.definition, lib.sequences.wake);
    const seconds = Math.max(0, sequenceDuration(lib.definition, lib.sequences.wake) - leadIn);
    setWakeSeconds(seconds);
    for (const player of [gray, twin]) {
      player.setAnimation(lib.sequences.wake);
      if (players.current.base !== gray) return;
      player.seek(leadIn);
      if (players.current.base !== gray) return;
      player.play();
    }
    phase.current = "awake";
    timers.current.push(window.setTimeout(() => setColored(true), 0));
    timers.current.push(window.setTimeout(() => {
      destroy("base");
      players.current.base = players.current.overlay; players.current.overlay = null;
      players.current.base?.setAnimation(lib.sequences.awake);
      players.current.base?.seek(sequenceLeadIn(lib.definition, lib.sequences.awake));
    }, Math.ceil(seconds * 1000) + 50));
  }

  useEffect(() => {
    if (typeof IntersectionObserver !== "function" || typeof ResizeObserver !== "function" || typeof WebGLRenderingContext === "undefined") { setFailed(true); return; }
    let disposed = false;
    setReady(false);
    void Promise.all([import("@paperclipai/shared/cliplab/runtime"), import("@paperclipai/shared/cliplab/character")]).then(([runtime, exported]) => {
      if (disposed) return;
      const definition = exported.PAPERCLIP_CHARACTER;
      library.current = { create: runtime.createCharacter, definition, sequences: resolveOnboardingSequences(definition) };
      mount(phase.current);
      if (players.current.base) setReady(true);
    }).catch((error: unknown) => {
      if (disposed) return;
      console.warn("Onboarding character unavailable, showing the still portrait.", error);
      fail();
    });
    return () => { disposed = true; clearTimers(); destroy("overlay"); destroy("base"); library.current = null; setReady(false); };
  }, []);

  useEffect(() => {
    if (!ready || !library.current || renderedPalette.current === identity.paletteId) return;
    try { mount(phase.current); } catch (error) {
      console.warn("Onboarding character palette change failed, showing the still portrait.", error);
      fail();
    }
  }, [identity.paletteId, ready]);

  useEffect(() => {
    if (!ready || !library.current || !players.current.base) return;
    const next: Phase = awake ? "awake" : "asleep";
    if (next === phase.current) return;
    try {
      if (next === "awake") wake(); else mount("asleep");
    } catch (error) {
      console.warn("Onboarding character transition failed, showing the still portrait.", error);
      fail();
    }
  }, [awake, ready]);

  const live = ready && !failed;
  return (
    <span className={cn("relative inline-block", className)} aria-hidden="true">
      <AgentAvatar appearance={identity} size={256} pose={awake ? "rest" : "sleepy"} muted={!awake} className={cn("size-full", live && "invisible")} />
      <span ref={base} className="absolute inset-0" />
      <span
        ref={overlay}
        className="absolute inset-0 transition-opacity ease-linear motion-reduce:transition-none"
        style={{ opacity: colored ? 1 : 0, transitionDuration: `${Math.max(0, wakeSeconds)}s` }}
      />
    </span>
  );
}
