// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MasterAgentRecord, MasterTeamRecord } from "@paperclipai/shared";
import en from "@/i18n/locales/en.json";
import { MasterAgents } from "./MasterAgents";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  listTeams: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  createTeam: vi.fn(),
  updateTeam: vi.fn(),
  defaultModel: vi.fn(),
  putDefaultModel: vi.fn(),
  getCurrentBoardAccess: vi.fn(),
  setBreadcrumbs: vi.fn(),
}));

vi.mock("@/api/masterAgents", () => ({
  masterAgentsApi: {
    list: mocks.list,
    listTeams: mocks.listTeams,
    create: mocks.create,
    update: mocks.update,
    remove: mocks.remove,
    createTeam: mocks.createTeam,
    updateTeam: mocks.updateTeam,
    defaultModel: mocks.defaultModel,
    putDefaultModel: mocks.putDefaultModel,
  },
}));

vi.mock("@/api/access", () => ({
  accessApi: {
    getCurrentBoardAccess: mocks.getCurrentBoardAccess,
  },
}));

vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: mocks.setBreadcrumbs }),
}));

vi.mock("@/lib/router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

vi.mock("@/components/onboarding/master-agent-icons", () => ({
  MasterAgentIcon: () => <span data-testid="agent-icon" />,
}));

function lookupEnglish(key: string) {
  const parts = key.split(".");
  let current: unknown = en;
  for (const part of parts) {
    if (!current || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : key;
}

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => lookupEnglish(key),
  }),
}));

const AGENT_ID = "11111111-1111-4111-8111-111111111111";

const agent: MasterAgentRecord = {
  id: AGENT_ID,
  slug: "chief-of-staff",
  title: "Chief of Staff",
  department: "leadership",
  role: "general",
  description: "Coordinates the company.",
  instructions: "Plan and coordinate.",
  icon: "briefcase",
  skillKeys: [],
  canCreateAgents: true,
  enabled: true,
  recommended: true,
  sortOrder: 0,
};

const teams: MasterTeamRecord[] = [];

let container: HTMLDivElement;
let root: Root;
let client: QueryClient;

async function eventually(assertion: () => void) {
  await vi.waitFor(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assertion();
  });
}

function button(text: string) {
  return [...document.querySelectorAll("button")].find((element) => element.textContent?.trim() === text);
}

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  nativeSetter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

async function renderPage() {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MasterAgents />
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.getCurrentBoardAccess.mockResolvedValue({
    user: null,
    userId: "local-board",
    isInstanceAdmin: true,
    companyIds: [],
    source: "local_implicit",
    keyId: null,
  });
  mocks.list.mockResolvedValue([agent]);
  mocks.listTeams.mockResolvedValue(teams);
  mocks.defaultModel.mockResolvedValue({
    configured: true,
    adapterType: "cursor",
    model: "auto",
    credentialKind: "stored_login",
  });
  mocks.create.mockResolvedValue({ ...agent, id: "22222222-2222-4222-8222-222222222222", slug: "new-agent", title: "New Agent" });
  mocks.update.mockImplementation(async (_id: string, body: Partial<MasterAgentRecord>) => ({ ...agent, ...body }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  document.body.innerHTML = "";
});

describe("MasterAgents", () => {
  it("opens the add-agent dialog and creates via the API", async () => {
    await renderPage();
    await eventually(() => {
      expect(mocks.list).toHaveBeenCalledWith(true);
      expect(button("Add agent")).toBeDefined();
      expect(container.textContent).toContain("Chief of Staff");
    });

    await act(async () => button("Add agent")!.click());
    await eventually(() => {
      expect(document.querySelector("#agent-title")).not.toBeNull();
      expect(document.body.textContent).toContain("Add agent");
    });

    await act(async () => {
      setInputValue(document.querySelector<HTMLInputElement>("#agent-title")!, "New Agent");
      setInputValue(document.querySelector<HTMLInputElement>("#agent-description")!, "Does new work.");
      setInputValue(document.querySelector<HTMLTextAreaElement>("#agent-instructions")!, "Do the new work.");
    });

    await act(async () => button("Save")!.click());
    await eventually(() => {
      expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
        title: "New Agent",
        description: "Does new work.",
        instructions: "Do the new work.",
      }));
    });
  });

  it("opens the edit dialog prefilled for an existing agent", async () => {
    await renderPage();
    await eventually(() => expect(button("Edit")).toBeDefined());

    await act(async () => button("Edit")!.click());
    await eventually(() => {
      expect(document.body.textContent).toContain("Edit agent");
      expect(document.querySelector<HTMLInputElement>("#agent-title")?.value).toBe("Chief of Staff");
      expect(document.querySelector<HTMLInputElement>("#agent-description")?.value).toBe("Coordinates the company.");
      expect(document.querySelector<HTMLTextAreaElement>("#agent-instructions")?.value).toBe("Plan and coordinate.");
    });
  });

  it("hides manage controls for non-admins and lists without includeDisabled", async () => {
    mocks.getCurrentBoardAccess.mockResolvedValue({
      user: { id: "user-1", email: "a@b.co", name: "A", image: null },
      userId: "user-1",
      isInstanceAdmin: false,
      companyIds: ["company-1"],
      source: "session",
      keyId: null,
    });

    await renderPage();
    await eventually(() => {
      expect(mocks.list).toHaveBeenCalledWith(false);
      expect(mocks.listTeams).toHaveBeenCalledWith(false);
      expect(container.textContent).toContain("Only instance admins can edit master agents.");
      expect(button("Add agent")).toBeUndefined();
      expect(button("Edit")).toBeUndefined();
      expect(button("Save model")).toBeUndefined();
      expect(container.textContent).toContain("Chief of Staff");
    });
  });

  it("surfaces list query errors", async () => {
    mocks.list.mockRejectedValue(new Error("boom"));
    await renderPage();
    await eventually(() => {
      expect(container.textContent).toContain("Failed to load master agents");
      expect(container.textContent).toContain("boom");
    });
  });
});
