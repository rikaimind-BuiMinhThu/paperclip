// @vitest-environment jsdom

import { type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkforceApproval } from "@/api/workforce";
import { ApprovalCard } from "./ApprovalCard";
import { WorkforceOverview } from "./WorkforceOverview";

const overview = vi.hoisted(() => vi.fn());

vi.mock("@/api/workforce", () => ({
  workforceApi: {
    overview,
    createWorkflow: vi.fn(),
  },
}));

vi.mock("@/context/CompanyContext", () => ({
  useCompany: () => ({ selectedCompanyId: "company-1" }),
}));

vi.mock("@/lib/router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

function render(node: ReactNode) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  flushSync(() => {
    root.render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  });
  return {
    host,
    cleanup() {
      flushSync(() => root.unmount());
      host.remove();
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  overview.mockReset();
});

describe("workforce pages", () => {
  it("shows the empty workforce overview", async () => {
    overview.mockResolvedValue({
      totalAgents: 0,
      invokableAgents: 0,
      runningShifts: 0,
      waitingForHumanShifts: 0,
      failedRunsLast7Days: 0,
      completedShifts: 0,
      monthSpendCents: 0,
      pendingApprovals: 0,
      nextRoutine: null,
      recentShifts: [],
      workflowCount: 0,
    });
    const view = render(<WorkforceOverview />);
    await vi.waitFor(() => {
      expect(view.host.textContent).toContain("No AI employees yet");
    });
    view.cleanup();
  });

  it("shows the approval payload subject", () => {
    const approval: WorkforceApproval = {
      id: "approval-1",
      agentName: "Sachi",
      toolName: "workforce.outbound_message",
      risk: "EXTERNAL_COMMUNICATION",
      payload: { to: "leads@example.com", subject: "Daily sales outreach", body: "Hello" },
      issueId: null,
      expiresAt: null,
      status: "pending",
    };
    const view = render(<ApprovalCard approval={approval} />);
    expect(view.host.querySelector("[data-testid=workforce-approval-subject]")?.textContent).toBe(
      "Subject: Daily sales outreach",
    );
    view.cleanup();
  });
});
