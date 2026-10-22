// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "@/i18n";

/**
 * The third way into hiring for a company that already exists: the "Add Agent"
 * card on `/{prefix}/onboarding`, shown once the wizard is dismissed. It opens
 * the medium hire-starter dialog (same gallery as onboarding step 3).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom's CSS parser rejects the custom-property marker rule stitches inserts
// (`--sxs{--sxs:N}`), pulled into <App>'s eager import graph transitively via
// @codesandbox/sandpack-react. Substitute a benign, valid rule on parse failure
// so stitches' index bookkeeping stays intact and the module graph evaluates.
vi.hoisted(() => {
  const sheetProto = window.CSSStyleSheet.prototype as unknown as {
    insertRule: (rule: string, index?: number) => number;
    __papLauncherPatched?: boolean;
  };
  if (!sheetProto.__papLauncherPatched) {
    const original = sheetProto.insertRule;
    sheetProto.insertRule = function patched(this: CSSStyleSheet, rule: string, index?: number) {
      try {
        return original.call(this, rule, index);
      } catch {
        try {
          return original.call(this, ".pap-launcher-noop{}", index);
        } catch {
          return this.cssRules?.length ?? 0;
        }
      }
    };
    sheetProto.__papLauncherPatched = true;
  }
});

const routeState = vi.hoisted(() => ({ companyPrefix: "PC1" as string | undefined }));
const dialogState = vi.hoisted(() => ({
  onboardingOpen: false,
  onboardingRouteDismissed: true,
  hireStarterOpen: false,
  openOnboarding: vi.fn(),
  openHireStarter: vi.fn(),
}));
const mockGoalsApi = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/lib/router", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ companyPrefix: routeState.companyPrefix }),
    useActiveCompanyPrefix: () => routeState.companyPrefix ?? null,
  };
});

vi.mock("./context/CompanyContext", () => ({
  useCompany: () => ({
    companies: [{ id: "company-1", name: "Acme", issuePrefix: "PC1" }],
    selectedCompanyId: "company-1",
    loading: false,
    error: null,
  }),
}));

vi.mock("./context/DialogContext", () => ({
  useDialogActions: () => ({
    openOnboarding: dialogState.openOnboarding,
    openHireStarter: dialogState.openHireStarter,
  }),
  useDialogState: () => ({
    onboardingOpen: dialogState.onboardingOpen,
    onboardingRouteDismissed: dialogState.onboardingRouteDismissed,
    hireStarterOpen: dialogState.hireStarterOpen,
  }),
}));

vi.mock("./api/goals", () => ({ goalsApi: mockGoalsApi }));

const { OnboardingRoutePage } = await import("./App");

const COMPANY_GOAL = {
  id: "goal-1",
  companyId: "company-1",
  title: "Scale the marketplace",
  description: null,
  level: "company",
  status: "active",
  parentId: null,
  ownerAgentId: null,
  createdAt: new Date("2026-03-02T00:00:00Z"),
  updatedAt: new Date("2026-03-02T00:00:00Z"),
};

describe("the onboarding launcher's Add Agent button", () => {
  let container: HTMLDivElement;
  let queryClient: QueryClient;
  let root: Root | null = null;

  async function render() {
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <QueryClientProvider client={queryClient}>
          <OnboardingRoutePage />
        </QueryClientProvider>,
      );
    });
  }

  async function settle(ticks = 12) {
    for (let i = 0; i < ticks; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  }

  function addAgentButton(): HTMLButtonElement {
    const label = t("app.onboarding.addAgent");
    const button = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(label),
    );
    // Asserted rather than optional-chained: a lookup that silently matches
    // nothing turns the click below into a no-op and the test into decoration.
    expect(button).toBeDefined();
    return button!;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    routeState.companyPrefix = "PC1";
    dialogState.onboardingOpen = false;
    dialogState.onboardingRouteDismissed = true;
    mockGoalsApi.list.mockResolvedValue([]);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    queryClient.clear();
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("opens the hire-starter dialog for a matched company", async () => {
    mockGoalsApi.list.mockResolvedValue([COMPANY_GOAL]);
    await render();
    await settle();

    await act(async () => {
      addAgentButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(dialogState.openHireStarter).toHaveBeenCalledTimes(1);
    expect(dialogState.openOnboarding).not.toHaveBeenCalled();
  });

  it("opens the hire-starter dialog whatever the goals lookup says", async () => {
    for (const goals of [
      () => mockGoalsApi.list.mockResolvedValue([]),
      () => mockGoalsApi.list.mockRejectedValue(new Error("goals unavailable")),
    ]) {
      dialogState.openHireStarter.mockClear();
      dialogState.openOnboarding.mockClear();
      goals();
      await render();
      await settle();

      await act(async () => {
        addAgentButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(dialogState.openHireStarter).toHaveBeenCalledTimes(1);
      expect(dialogState.openOnboarding).not.toHaveBeenCalled();
    }
  });

  it("opens with no company when the prefix matches none", async () => {
    routeState.companyPrefix = "NOPE";
    await render();
    await settle();

    const startLabel = t("app.onboarding.start");
    const start = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes(startLabel),
    );
    expect(start).toBeDefined();
    await act(async () => {
      start!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(dialogState.openOnboarding).toHaveBeenCalledWith();
  });
});
