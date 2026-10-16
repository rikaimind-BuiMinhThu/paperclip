// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { act } from "react";
import { PublicHome } from "./PublicHome";

const mockHealthApi = vi.hoisted(() => ({
  get: vi.fn(),
}));
const mockAuthApi = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/api/health", () => ({
  healthApi: mockHealthApi,
}));

vi.mock("@/api/auth", () => ({
  authApi: mockAuthApi,
}));

vi.mock("./MarketingLandingPage", () => ({
  MarketingLandingPage: () => <div>Marketing landing</div>,
}));

async function waitForText(container: HTMLElement, text: string) {
  await vi.waitFor(() => {
    expect(container.textContent).toContain(text);
  });
}

function renderPublicHome(container: HTMLDivElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PublicHome appEntry={<div>App entry</div>} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  });
  return root;
}

describe("PublicHome", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockHealthApi.get.mockResolvedValue({
      status: "ok",
      deploymentMode: "authenticated",
    });
    mockAuthApi.getSession.mockResolvedValue(null);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("shows the marketing landing for authenticated guests", async () => {
    root = renderPublicHome(container);
    await waitForText(container, "Marketing landing");
    expect(container.textContent).not.toContain("App entry");
  });

  it("enters the app when a session exists", async () => {
    mockAuthApi.getSession.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
    });
    root = renderPublicHome(container);
    await waitForText(container, "App entry");
    expect(container.textContent).not.toContain("Marketing landing");
  });

  it("enters the app in local trusted mode without a session", async () => {
    mockHealthApi.get.mockResolvedValue({
      status: "ok",
      deploymentMode: "local_trusted",
    });
    root = renderPublicHome(container);
    await waitForText(container, "App entry");
    expect(mockAuthApi.getSession).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Marketing landing");
  });
});
