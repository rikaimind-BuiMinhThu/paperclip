// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { DEFAULT_LOCALE } from "@/i18n/locales";

// --- Mocks (hoisted so vi.mock factories can close over them) ----------------

// The company list is keyed by account, so it holds until the session query
// *succeeds*. A seeded entry is stale under the test client and refetches, so
// the refetch has to answer too — otherwise the identity errors and the list
// never runs.
const mockAuthApi = vi.hoisted(() => ({ getSession: vi.fn() }));
const localHealth = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/api/health", () => ({ healthApi: localHealth }));
const managedApi = vi.hoisted(() => ({
  list: vi.fn(async () => ({ currentUserId: "user-1", connections: [] })),
  startLocalLogin: vi.fn(async () => ({ sessionId: "local-attempt", command: "CODEX_HOME='/fixture/login' codex login", expiresAt: "2026-09-11T20:00:00Z" })),
  checkLocalLogin: vi.fn(async () => ({ status: "sign_in_required" as "sign_in_required" | "ready" })),
  cancelLocalLogin: vi.fn(async () => ({})),
  connectLocal: vi.fn(async () => ({ connectionId: "local-connection", grantId: "local-grant" })),
  create: vi.fn(async () => ({ connectionId: "managed-connection", grantId: "managed-grant" })),
}));
vi.mock("@/api/ai-connections", () => ({ aiConnectionsApi: managedApi }));
vi.mock("../api/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/auth")>();
  return { ...actual, authApi: { ...actual.authApi, getSession: mockAuthApi.getSession } };
});

const mockDialog = vi.hoisted(() => ({
  onboardingOpen: true,
  onboardingOptions: {} as { initialStep?: number; companyId?: string },
  closeOnboarding: vi.fn(),
  onboardingRouteDismissed: false,
  setOnboardingRouteDismissed: vi.fn(),
}));

const mockCompany = vi.hoisted(() => ({
  companies: [] as Array<{ id: string; name: string; issuePrefix: string }>,
  setSelectedCompanyId: vi.fn(),
  loading: false,
  error: null as Error | null,
}));

const mockCompaniesApi = vi.hoisted(() => ({
  detachInflightList: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  // The gate fetches the list itself now, rather than reading the shared
  // cache, so ownership cases are driven from here. `mockCompany.companies`
  // below still feeds the *inner* wizard, which is a different question.
  list: vi.fn(),
}));
const mockGoalsApi = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(async () => []),
}));
const mockAgentsApi = vi.hoisted(() => ({
  adapterModels: vi.fn(async () => [] as Array<{ id: string; label: string }>),
  testEnvironment: vi.fn(
    async (): Promise<import("@paperclipai/shared").AdapterEnvironmentTestResult> => ({
      adapterType: "claude_local",
      status: "pass",
      checks: [],
      testedAt: new Date().toISOString(),
    }),
  ),
  hire: vi.fn(async () => ({ agent: { id: "agent-1" }, approval: null })),
  // The hire step lists the company's agents first and adopts one that already
  // carries the typed name on the same source, so a wizard that reopens on the
  // agent step cannot hire "Ada 2". Empty by default: the company is new.
  list: vi.fn(async () => [] as Array<{ id: string; name: string; adapterType: string }>),
  instructionsBundle: vi.fn(async () => ({ entryFile: "AGENTS.md" })),
  saveInstructionsFile: vi.fn(async () => ({})),
  // No default implementation: the top-level `beforeEach` sets the "no
  // stored value" 404 rejection, using the real `ApiError` class the code
  // under test checks with `instanceof`.
  getClaudeOAuthTokenStatus: vi.fn(),
  getAdapterAuthSignal: vi.fn(
    async (): Promise<import("@paperclipai/shared").AdapterAuthSignalResponse> => ({
      status: "present",
    }),
  ),
  // The sign-in routes. The connect step's Connect button starts a login rather
  // than hiring when the signal says the source has no credential, so the two
  // login shapes need enough of a server to reach the state the step is about:
  // a session that is running, and a prompt to show for it.
  startClaudeSetupTokenLogin: vi.fn(async () => ({
    sessionId: "claude-session-1",
    status: "pending",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  })),
  getClaudeSetupTokenLoginStatus: vi.fn(async () => ({
    sessionId: "claude-session-1",
    status: "pending",
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
  })),
  getClaudeSetupTokenLoginPrompt: vi.fn(async () => ({
    authorizationUrl: "https://claude.ai/oauth/authorize?code=true",
    transportAdvisory: null,
  })),
  cancelClaudeSetupTokenLogin: vi.fn(async () => ({})),
  submitClaudeSetupTokenBrowserCode: vi.fn(async () => ({})),
  completeClaudeSetupTokenLogin: vi.fn(async () => ({ storedSessionId: "stored-1" })),
  startAdapterAuthLogin: vi.fn(async () => ({
    sessionId: "codex-session-1",
    status: "pending",
  })),
  getAdapterAuthLoginStatus: vi.fn(async () => ({
    sessionId: "codex-session-1",
    status: "pending",
    prompt: { url: "https://auth.openai.com/codex/device", code: "Q2RJ-E1YIF" },
  })),
  cancelAdapterAuthLogin: vi.fn(async () => ({})),
  // No default implementation: the top-level `beforeEach` sets the "no active
  // session" 404 rejection, matching the real route.
  getActiveAdapterAuthLoginSession: vi.fn(),
  getActiveClaudeSetupTokenLoginSession: vi.fn(),
}));
// The adapter registry mock below always returns this function, so a test
// can shape the built adapter config (e.g. a configured ANTHROPIC_API_KEY)
// without a real adapter package.
const mockAdapterBuild = vi.hoisted(() => ({
  buildAdapterConfig: vi.fn(() => ({}) as Record<string, unknown>),
}));
// The Connect path loads environment settings before probing; without these
// the probe dies on "Could not load environment settings" and the hire never
// runs — which reads as a mysterious 0-call assertion, not an error.
const mockEnvironmentsApi = vi.hoisted(() => ({
  list: vi.fn(async () => [] as Array<Record<string, unknown>>),
  capabilities: vi.fn(
    async (): Promise<import("@paperclipai/shared").EnvironmentCapabilities> =>
      (await import("@paperclipai/shared")).getEnvironmentCapabilities([]),
  ),
}));
const mockInstanceSettingsApi = vi.hoisted(() => ({
  get: vi.fn(async () => ({ defaultEnvironmentId: null as string | null })),
  getExperimental: vi.fn(async () => ({ enableManagedSandboxOnly: false })),
}));
const mockApprovalsApi = vi.hoisted(() => ({
  create: vi.fn(),
}));
const mockSecretsApi = vi.hoisted(() => ({
  list: vi.fn(),
  removeUserSecretDefinition: vi.fn(),
  listMyUserSecrets: vi.fn(),
  createUserSecretDefinition: vi.fn(),
  createMyUserSecret: vi.fn(),
  rotateMyUserSecret: vi.fn(),
}));
const mockIssuesApi = vi.hoisted(() => ({
  create: vi.fn(),
}));
const mockProjectsApi = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(async () => []),
}));

// The real adapter registry eagerly imports every adapter package. The
// model/harness picker internals are out of scope here, so stub the adapter
// layer entirely and drive it through this knob.
const mockAdapterRegistry = vi.hoisted(() => ({
  list: [] as Array<{ type: string }>,
  disabled: new Set<string>(),
}));

vi.mock("@/lib/router", () => ({
  useLocation: () => ({ pathname: "/", search: "", hash: "", state: null }),
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
}));
vi.mock("../context/DialogContext", () => ({
  useDialog: () => mockDialog,
}));
vi.mock("../context/CompanyContext", () => ({
  useCompany: () => mockCompany,
}));
vi.mock("../api/companies", () => ({ companiesApi: mockCompaniesApi }));
vi.mock("../api/goals", () => ({ goalsApi: mockGoalsApi }));
vi.mock("../api/agents", () => ({ agentsApi: mockAgentsApi }));
vi.mock("../api/approvals", () => ({ approvalsApi: mockApprovalsApi }));
vi.mock("../api/secrets", () => ({ secretsApi: mockSecretsApi }));
vi.mock("../api/issues", () => ({ issuesApi: mockIssuesApi }));
vi.mock("../api/projects", () => ({ projectsApi: mockProjectsApi }));
vi.mock("../api/environments", () => ({ environmentsApi: mockEnvironmentsApi }));
vi.mock("../api/instanceSettings", () => ({ instanceSettingsApi: mockInstanceSettingsApi }));
const mockMasterAgentsApi = vi.hoisted(() => ({
  list: vi.fn(async () => [] as Array<Record<string, unknown>>),
  listTeams: vi.fn(async () => [] as Array<Record<string, unknown>>),
  defaultModel: vi.fn(async () => ({
    configured: true,
    adapterType: "claude_local" as const,
    model: "claude-sonnet",
    credentialKind: "api_key" as const,
  })),
  hire: vi.fn(async () => ({
    agents: [{ id: "agent-1", name: "Chief of Staff" }],
    managerAgentId: "agent-1",
    label: "Chief of Staff",
  })),
}));
vi.mock("@/api/masterAgents", () => ({ masterAgentsApi: mockMasterAgentsApi }));
vi.mock("@/api/access", () => ({
  accessApi: {
    getCurrentBoardAccess: vi.fn(async () => ({
      isInstanceAdmin: false,
      source: "session",
      userId: "user-1",
      companyIds: [],
      user: null,
      keyId: null,
    })),
  },
}));
vi.mock("../adapters", () => ({
  listUIAdapters: () => mockAdapterRegistry.list,
  getUIAdapter: () => ({ buildAdapterConfig: mockAdapterBuild.buildAdapterConfig }),
}));
vi.mock("../adapters/metadata", () => ({ isVisualAdapterChoice: () => true }));
vi.mock("../adapters/adapter-display-registry", () => ({
  getAdapterDisplay: (type: string) => ({
    type,
    // Mirrors the real registry: Claude, OpenAI, and Cursor are `recommended`.
    // A blanket `false` used to be harmless because every adapter
    // then sat in the "Advanced settings" disclosure and was reachable anyway;
    // with the step down to a tile row built from this flag, it made that row
    // empty in every test and hid the surface under it.
    recommended: type === "claude_local" || type === "codex_local" || type === "cursor",
    label: type,
    description: "",
    icon: () => null,
  }),
  getAdapterLabel: (type: string) => type,
  getAdapterLabels: () => ({}) as Record<string, string>,
  isKnownAdapterType: () => true,
}));
vi.mock("../adapters/use-disabled-adapters", () => ({
  useDisabledAdaptersSync: () => mockAdapterRegistry.disabled,
  // Added by #11371's adapter snap. A module mock replaces the whole module,
  // so every export the component reaches for has to be here — omitting one
  // makes it undefined and the call throws.
  useAdapterRegistryLoaded: () => true,
}));
// Adapters with a declared login capability, mirroring the real registry:
// `claude_local` and `codex_local` both support a sandbox login, and every
// other type has none, matching the real `useAdapterCapabilities` fallback for
// an unlisted type.
//
// The panel modes are the real ones rather than one mode for both. They used to
// be, back when nothing outside the panel dispatcher read them. The connect
// step reads them now — the two logins end in different places, so its button
// waits differently for each — and a mock that called Claude's login
// `displayed_code` would have the step testing the wrong half of that.
// Reconcile with KNOWN_DEFAULTS in `adapters/use-adapter-capabilities.ts`.
const ADAPTER_LOGIN_MODES: Record<string, "displayed_code" | "submitted_browser_code"> = {
  claude_local: "submitted_browser_code",
  codex_local: "displayed_code",
};
vi.mock("../adapters/use-adapter-capabilities", () => ({
  useAdapterCapabilities: () => (type: string) => ({
    supportsInstructionsBundle: false,
    supportsSkills: false,
    supportsLocalAgentJwt: false,
    requiresMaterializedRuntimeSkills: false,
    login: ADAPTER_LOGIN_MODES[type]
      ? { panelMode: ADAPTER_LOGIN_MODES[type]!, timeoutPolicy: "fixed" as const }
      : undefined,
  }),
}));
// Animation / canvas-ish children that add nothing to the logic under test.
vi.mock("./AsciiArtAnimation", () => ({ AsciiArtAnimation: () => null }));
vi.mock("./AgentCapsule", () => ({ AgentCapsule: () => null }));

import { ApiError } from "../api/client";
import { queryKeys } from "../lib/queryKeys";
import { ADAPTER_AUTH_MISSING_CHECK_CODE, getEnvironmentCapabilities } from "@paperclipai/shared";
import { CLAUDE_OAUTH_TOKEN_ENV_KEY } from "./environment-variables-editor/model";
import { ONBOARDING_STORAGE_KEY, OnboardingWizard } from "./OnboardingWizard";
import { CONNECTED_HOLD_MS } from "./onboarding/onboarding-motion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/** React tracks input value on the DOM node; set it the way React will see. */
function setControlledValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

const SESSION_USER_ID = "user-b";

function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // The company list is keyed by account, so it stays disabled until the
  // session is known. Seeding it is how these tests say "signed in as B".
  queryClient.setQueryData(queryKeys.auth.session, {
    session: { id: "session-b", userId: SESSION_USER_ID },
    user: { id: SESSION_USER_ID, name: "B", email: "b@example.com", image: null },
  });
  return { container, root, queryClient };
}

describe("OnboardingWizard restore-gate (stale localStorage across accounts)", () => {
  beforeAll(async () => {
    // Assertions target English CTA copy; production default locale is Japanese.
    await i18n.changeLanguage("en");
  });

  afterAll(async () => {
    await i18n.changeLanguage(DEFAULT_LOCALE);
  });

  beforeEach(() => {
    localHealth.get.mockResolvedValue({ deploymentMode: "authenticated" });
    managedApi.checkLocalLogin.mockReset().mockResolvedValue({ status: "sign_in_required" });
    managedApi.connectLocal.mockReset().mockResolvedValue({ connectionId: "local-connection", grantId: "local-grant" });
    mockAuthApi.getSession.mockResolvedValue({
      session: { id: "session-b", userId: SESSION_USER_ID },
      user: { id: SESSION_USER_ID, name: "B", email: "b@example.com", image: null },
    });
    mockSecretsApi.list.mockResolvedValue([]);
    mockSecretsApi.listMyUserSecrets.mockResolvedValue([]);
    mockSecretsApi.removeUserSecretDefinition.mockResolvedValue({ ok: true });
    window.localStorage.clear();
    mockDialog.onboardingOpen = true;
    mockDialog.onboardingOptions = {};
    mockDialog.onboardingRouteDismissed = false;
    mockCompany.companies = [];
    mockCompany.loading = false;
    mockCompany.error = null;
    mockCompaniesApi.list.mockResolvedValue([]);
    mockAdapterRegistry.list = [];
    mockAdapterRegistry.disabled = new Set<string>();
    mockAdapterBuild.buildAdapterConfig.mockReset();
    mockAdapterBuild.buildAdapterConfig.mockReturnValue({});
    // Default: no stored Claude login for the owner. The route returns a
    // fixed 404 for a missing value, so the client treats a real `ApiError`
    // with that status as "no stored value" rather than a hard failure.
    mockAgentsApi.getClaudeOAuthTokenStatus.mockReset();
    mockAgentsApi.getClaudeOAuthTokenStatus.mockRejectedValue(
      new ApiError("Not found", 404, null),
    );
    // Default: no active login session for the caller. A resume test
    // overrides this with a resolved session body.
    mockAgentsApi.getActiveAdapterAuthLoginSession.mockReset();
    mockAgentsApi.getActiveAdapterAuthLoginSession.mockRejectedValue(
      new ApiError("Not found", 404, null),
    );
    mockAgentsApi.getActiveClaudeSetupTokenLoginSession.mockReset();
    mockAgentsApi.getActiveClaudeSetupTokenLoginSession.mockRejectedValue(
      new ApiError("Not found", 404, null),
    );
    // Reset to each mock's original default. `mockResolvedValue` /
    // `mockReturnValue` overrides a mock's implementation permanently — it
    // is not undone by `afterEach`'s `vi.clearAllMocks()`, which only clears
    // call history — so a test that customizes one of these must not leak
    // its override into the next test.
    mockAgentsApi.testEnvironment.mockReset();
    mockAgentsApi.testEnvironment.mockResolvedValue({
      adapterType: "claude_local",
      status: "pass" as const,
      checks: [],
      testedAt: new Date().toISOString(),
    });
    mockAgentsApi.hire.mockReset();
    mockAgentsApi.hire.mockResolvedValue({ agent: { id: "agent-1" }, approval: null });
    mockCompaniesApi.create.mockResolvedValue({
      id: "created",
      name: "Created Co",
      issuePrefix: "CRE",
    });
    mockCompaniesApi.update.mockResolvedValue({
      id: "c1",
      name: "Acme Rockets",
      issuePrefix: "PAP",
    });
    mockGoalsApi.create.mockResolvedValue({ id: "goal-1" });
    mockGoalsApi.list.mockResolvedValue([]);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  describe("step 1 leads straight to the agent — there is no mission step 2", () => {
    // One path now: Name your organization → Name your agent → Connect → Get
    // started. The Build / Grow front door and both mission screens are gone,
    // so "Continue" on step 1 creates the organization and lands on the agent
    // step with no mission question in between.

    async function openStepOne() {
      window.localStorage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify({ step: 1, companyName: "Initech" }),
      );
      mockDialog.onboardingOptions = {};
      mockCompany.companies = [];
      mockCompany.loading = false;
      mockCompaniesApi.list.mockResolvedValue([]);

      // The model step needs tiles to pick from, and this suite's default
      // registry is empty.
      mockAdapterRegistry.list = [{ type: "claude_local" }, { type: "codex_local" }];
      const { root, queryClient } = render();
      const renderTree = () =>
        act(async () => {
          root.render(
            <QueryClientProvider client={queryClient}>
              <OnboardingWizard />
            </QueryClientProvider>,
          );
        });
      await renderTree();
      await flushReact();
      return { root, renderTree };
    }

    async function clickByText(match: (text: string) => boolean) {
      const el = [...document.body.querySelectorAll("button")].find((b) =>
        match(b.textContent?.trim() ?? ""),
      )!;
      await act(async () => {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await flushReact();
    }

    it("creates the organization on Continue and lands on the agent step, no mission", async () => {
      mockCompaniesApi.create.mockResolvedValue({ id: "company-new", issuePrefix: "INI" });
      const { root } = await openStepOne();
      await clickByText((t) => t.startsWith("Continue"));

      expect(mockCompaniesApi.create).toHaveBeenCalledWith({ name: "Initech" });
      expect(document.body.textContent).toContain("Choose a starter");
      expect(document.body.textContent).not.toContain("Define your mission");
      expect(document.body.textContent).not.toContain("Tell us about your team");

      await act(async () => root.unmount());
    });

    it("lands on the starter gallery with no model tiles", async () => {
      mockCompaniesApi.create.mockResolvedValue({ id: "company-new", issuePrefix: "INI" });
      const { root } = await openStepOne();
      await clickByText((t) => t.startsWith("Continue"));
      expect(document.body.textContent).toContain("Choose a starter");
      expect(document.body.textContent).not.toContain("Connect a model");
      expect(document.body.textContent).not.toContain("Model source");
      expect(document.querySelector("#onboarding-agent-name")).toBeNull();
      await act(async () => root.unmount());
    });

    it("creates one company for one keystroke, modifier or not", async () => {
      // The name field handles Enter itself and does not check for a modifier,
      // so Cmd+Enter in that field reaches the field's handler *and* the
      // wizard's step-level one. Both would start creating. The step-level
      // `loading` guard cannot stop it — `setLoading(true)` has not landed
      // while the same event is still bubbling — so the second caller reads a
      // value the first has not written. Two companies, one keystroke.
      mockCompaniesApi.create.mockResolvedValue({ id: "company-new", issuePrefix: "INI" });
      const { root } = await openStepOne();

      const nameInput = document.body.querySelector(
        'input[placeholder="e.g. Northwind Labs"]',
      ) as HTMLInputElement;
      await act(async () => {
        nameInput.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", metaKey: true, bubbles: true }),
        );
      });
      await flushReact();

      expect(mockCompaniesApi.create).toHaveBeenCalledTimes(1);
      expect(document.body.textContent).toContain("Choose a starter");

      await act(async () => root.unmount());
    });

    it("creates one company however many times Enter repeats", async () => {
      // Holding Enter down fires keydown repeatedly. Each one is a separate
      // event, so `defaultPrevented` says nothing about the others, and neither
      // `loading` nor `createdCompanyId` has been written by the time the next
      // arrives — the first is state, the second is not set until the request
      // it guards resolves. Only a ref written before the request goes out is
      // visible to the caller behind it.
      let resolveCreate: (c: { id: string; issuePrefix: string }) => void = () => {};
      mockCompaniesApi.create.mockReturnValue(
        new Promise<{ id: string; issuePrefix: string }>((resolve) => {
          resolveCreate = resolve;
        }),
      );
      const { root } = await openStepOne();

      const nameInput = document.body.querySelector(
        'input[placeholder="e.g. Northwind Labs"]',
      ) as HTMLInputElement;
      await act(async () => {
        for (let i = 0; i < 4; i++) {
          nameInput.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
          );
        }
      });

      expect(mockCompaniesApi.create).toHaveBeenCalledTimes(1);

      await act(async () => resolveCreate({ id: "company-new", issuePrefix: "INI" }));
      await flushReact();
      expect(document.body.textContent).toContain("Choose a starter");

      await act(async () => root.unmount());
    });

    it("sends Back to the screen the run actually came from", async () => {
      // A create run reached the agent step from step 1, so Back owes it step 1 —
      // not the mission screen it never saw.
      mockCompaniesApi.create.mockResolvedValue({ id: "company-new", issuePrefix: "INI" });
      const { root } = await openStepOne();
      await clickByText((t) => t.startsWith("Continue"));
      expect(document.body.textContent).toContain("Choose a starter");

      await clickByText((t) => t.trim() === "Back");

      expect(document.body.textContent).toContain("What is the name of your organization?");
      expect(document.body.textContent).not.toContain("Define your mission");

      await act(async () => root.unmount());
    });
  });

  describe("starter gallery", () => {
    const chiefId = "11111111-1111-4111-8111-111111111111";
    const writerId = "22222222-2222-4222-8222-222222222222";
    const editorId = "33333333-3333-4333-8333-333333333333";
    const agents = [
      {
        id: chiefId,
        slug: "chief-of-staff",
        title: "Chief of Staff",
        department: "leadership",
        role: "general",
        description: "Your main contact. Plans work and coordinates the company.",
        instructions: "Lead {{organizationName}}.",
        icon: "briefcase",
        skillKeys: [],
        canCreateAgents: true,
        enabled: true,
        recommended: true,
        sortOrder: 0,
      },
      {
        id: writerId,
        slug: "content-writer",
        title: "Content Writer",
        department: "marketing",
        role: "cmo",
        description: "Writes articles, posts, and landing-page copy.",
        instructions: "Write.",
        icon: "pen-line",
        skillKeys: [],
        canCreateAgents: false,
        enabled: true,
        recommended: false,
        sortOrder: 1,
      },
      {
        id: editorId,
        slug: "video-editor",
        title: "Video Editor",
        department: "marketing",
        role: "cmo",
        description: "Cuts and publishes video.",
        instructions: "Edit.",
        icon: "clapperboard",
        skillKeys: [],
        canCreateAgents: false,
        enabled: true,
        recommended: false,
        sortOrder: 2,
      },
    ];

    beforeEach(() => {
      mockMasterAgentsApi.list.mockResolvedValue(agents);
      mockMasterAgentsApi.listTeams.mockResolvedValue([]);
      mockMasterAgentsApi.defaultModel.mockResolvedValue({
        configured: true,
        adapterType: "claude_local",
        model: "claude-sonnet",
        credentialKind: "api_key",
      });
      mockMasterAgentsApi.hire.mockResolvedValue({
        agents: [{ id: "agent-1", name: "Chief of Staff" }],
        managerAgentId: "agent-1",
        label: "Chief of Staff",
      });
    });

    async function openGallery(step = 3) {
      window.localStorage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify({ step, companyName: "Initech", createdCompanyId: "company-new" }),
      );
      mockCompany.companies = [{ id: "company-new", name: "Initech", issuePrefix: "INI" }];
      mockCompaniesApi.list.mockResolvedValue(mockCompany.companies);
      const { root, queryClient } = render();
      await act(async () => {
        root.render(
          <QueryClientProvider client={queryClient}>
            <OnboardingWizard />
          </QueryClientProvider>,
        );
      });
      await flushReact();
      await flushReact();
      return root;
    }

    function checkedTitle() {
      const selected = document.body.querySelector("button[role='radio'][aria-checked='true']");
      return selected?.textContent ?? "";
    }

    it("opens Leadership with Chief of Staff checked and no model tiles", async () => {
      const root = await openGallery();
      expect(document.body.textContent).toContain("Choose a starter");
      expect(document.body.textContent).toContain("Leadership");
      expect(checkedTitle()).toContain("Chief of Staff");
      expect(document.body.textContent).toContain("Selected: Chief of Staff");
      expect(document.body.textContent).not.toContain("Connect a model");
      expect(document.body.textContent).not.toContain("Model source");
      await act(async () => root.unmount());
    });

    it("lists Content Writer and Video Editor under Marketing and keeps the selection", async () => {
      const root = await openGallery();
      const marketing = [...document.body.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("Marketing"),
      )!;
      await act(async () => {
        marketing.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      await flushReact();
      expect(document.body.textContent).toContain("Content Writer");
      expect(document.body.textContent).toContain("Video Editor");
      expect(document.body.textContent).toContain("Selected: Chief of Staff");
      expect(checkedTitle()).not.toContain("Content Writer");
      await act(async () => root.unmount());
    });

    it("resumes a draft saved on the old connect step", async () => {
      const root = await openGallery(4);
      expect(document.body.textContent).toContain("Choose a starter");
      expect(checkedTitle()).toContain("Chief of Staff");
      expect(document.body.textContent).not.toContain("Connect a model");
      await act(async () => root.unmount());
    });

    it("disables Continue when the platform model is missing", async () => {
      mockMasterAgentsApi.defaultModel.mockResolvedValue({
        configured: false,
        adapterType: null,
        model: null,
        credentialKind: null,
      });
      const root = await openGallery();
      const continueButton = [...document.body.querySelectorAll("button")].find((button) =>
        button.textContent?.trim().startsWith("Continue"),
      ) as HTMLButtonElement;
      expect(continueButton.disabled).toBe(true);
      expect(document.body.textContent).toContain("An instance admin must set the platform model.");
      await act(async () => root.unmount());
    });
  });

});
