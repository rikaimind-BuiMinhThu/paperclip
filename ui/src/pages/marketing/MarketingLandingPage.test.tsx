// @vitest-environment jsdom

import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
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

    expect(container.textContent).toContain(ja.landing.hero.title);
    expect(container.textContent).toContain(ja.landing.brand);
    const authLinks = Array.from(container.querySelectorAll('a[href="/auth"]'));
    expect(authLinks.length).toBeGreaterThan(0);
    expect(container.querySelector("#product")).not.toBeNull();
    expect(container.querySelector("#faq")).not.toBeNull();
    const page = container.querySelector("#product")?.closest(".h-dvh");
    expect(page?.className).toContain("overflow-y-auto");
  });
});
