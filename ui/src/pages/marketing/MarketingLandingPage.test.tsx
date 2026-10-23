// @vitest-environment jsdom

import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { MarketingLandingPage } from "./MarketingLandingPage";
import { LocaleProvider } from "@/context/LocaleContext";
import { ThemeProvider } from "@/context/ThemeContext";
import ja from "@/i18n/locales/ja.json";

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children?: ReactNode; className?: string; "aria-label"?: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe("MarketingLandingPage", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;
  let originalResizeObserver: typeof ResizeObserver | undefined;

  beforeEach(() => {
    originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class ResizeObserver {
      constructor(private callback: ResizeObserverCallback) {}
      observe() {
        this.callback([], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    };

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function mockRect(
      this: HTMLElement,
    ) {
      const testId = this.getAttribute("data-testid") ?? "";
      const org = this.classList.contains("landing-hero-org");
      if (org || testId === "landing-org-chart-visual") {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: 220,
          right: 360,
          width: 360,
          height: 220,
          toJSON() {
            return {};
          },
        } as DOMRect;
      }
      const chipTops: Record<string, { left: number; top: number; width: number }> = {
        "landing-agent-chip-cmo": { left: 120, top: 8, width: 120 },
        "landing-agent-chip-content-writer": { left: 8, top: 120, width: 108 },
        "landing-agent-chip-video-editor": { left: 126, top: 120, width: 108 },
        "landing-agent-chip-social-media-manager": { left: 244, top: 120, width: 108 },
      };
      const chip = chipTops[testId];
      if (chip) {
        return {
          x: chip.left,
          y: chip.top,
          top: chip.top,
          left: chip.left,
          bottom: chip.top + 48,
          right: chip.left + chip.width,
          width: chip.width,
          height: 48,
          toJSON() {
            return {};
          },
        } as DOMRect;
      }
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON() {
          return {};
        },
      } as DOMRect;
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    vi.restoreAllMocks();
    globalThis.ResizeObserver = originalResizeObserver!;
  });

  it("renders the Kujira AI Harness hero and primary auth CTA", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <ThemeProvider>
          <LocaleProvider>
            <MarketingLandingPage />
          </LocaleProvider>
        </ThemeProvider>,
      );
    });

    // Allow layout effect + ResizeObserver measure to flush.
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain(ja.landing.hero.title);
    expect(container.textContent).toContain(ja.landing.brand);
    const authLinks = Array.from(container.querySelectorAll('a[href="/auth"]'));
    expect(authLinks.length).toBeGreaterThan(0);
    expect(container.querySelector("#product")).not.toBeNull();
    expect(container.querySelector("#faq")).not.toBeNull();
    const page = container.querySelector("#product")?.closest(".h-dvh");
    expect(page?.className).toContain("overflow-y-auto");

    const visual = container.querySelector('[data-testid="landing-org-chart-visual"]');
    expect(visual).not.toBeNull();
    expect(visual?.textContent).toContain(ja.landing.visual.cmo);
    expect(visual?.textContent).toContain(ja.landing.visual["content-writer"]);
    expect(visual?.textContent).toContain(ja.landing.visual["video-editor"]);
    expect(visual?.textContent).toContain(ja.landing.visual["social-media-manager"]);
    expect(visual?.querySelectorAll('[data-slot="agent-avatar"]').length).toBe(4);
    expect(container.querySelector('[data-testid="landing-org-work-flow"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="landing-org-work-flow-edge-cmo-content-writer"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="landing-org-work-flow-packet-brief-writer-down"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="landing-org-work-flow-packet-review-video-up"]')).not.toBeNull();
  });
});
