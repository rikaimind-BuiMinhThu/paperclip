// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DialogProvider, useDialogActions, useDialogState } from "./DialogContext";

const mockCompany = vi.hoisted(() => ({
  selectedCompanyId: null as string | null,
}));

vi.mock("./CompanyContext", async () => {
  const actual = await vi.importActual<typeof import("./CompanyContext")>("./CompanyContext");
  return {
    ...actual,
    useOptionalCompany: () =>
      mockCompany.selectedCompanyId
        ? ({ selectedCompanyId: mockCompany.selectedCompanyId } as ReturnType<typeof actual.useOptionalCompany>)
        : null,
  };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("DialogContext", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    mockCompany.selectedCompanyId = null;
  });

  it("keeps action-only consumers from rerendering when dialog state changes", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let actionRenderCount = 0;
    let stateRenderCount = 0;

    function ActionOnlyConsumer() {
      actionRenderCount += 1;
      const { openNewIssue } = useDialogActions();
      return <button onClick={() => openNewIssue()}>Open issue</button>;
    }

    function StateConsumer() {
      stateRenderCount += 1;
      const { newIssueOpen } = useDialogState();
      return <span>{newIssueOpen ? "open" : "closed"}</span>;
    }

    act(() => {
      root.render(
        <DialogProvider>
          <ActionOnlyConsumer />
          <StateConsumer />
        </DialogProvider>,
      );
    });

    expect(actionRenderCount).toBe(1);
    expect(stateRenderCount).toBe(1);

    const button = host.querySelector("button");
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(host.textContent).toContain("open");
    expect(actionRenderCount).toBe(1);
    expect(stateRenderCount).toBe(2);

    act(() => root.unmount());
  });

  it("opens the hire-starter dialog when a company is selected", () => {
    mockCompany.selectedCompanyId = "company-1";
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);

    function Probe() {
      const { openNewAgent } = useDialogActions();
      const { newAgentOpen, hireStarterOpen, onboardingOpen } = useDialogState();
      return (
        <div>
          <button type="button" onClick={() => openNewAgent()}>
            Add
          </button>
          <span data-testid="new-agent">{newAgentOpen ? "new" : "closed"}</span>
          <span data-testid="hire-starter">{hireStarterOpen ? "open" : "closed"}</span>
          <span data-testid="onboarding">{onboardingOpen ? "open" : "closed"}</span>
        </div>
      );
    }

    act(() => {
      root.render(
        <DialogProvider>
          <Probe />
        </DialogProvider>,
      );
    });

    act(() => {
      host.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(host.querySelector('[data-testid="new-agent"]')?.textContent).toBe("closed");
    expect(host.querySelector('[data-testid="hire-starter"]')?.textContent).toBe("open");
    expect(host.querySelector('[data-testid="onboarding"]')?.textContent).toBe("closed");

    act(() => root.unmount());
  });
});
