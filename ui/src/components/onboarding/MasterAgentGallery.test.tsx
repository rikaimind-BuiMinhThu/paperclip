// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentAvatarUrl, legacyAgentAppearance } from "@paperclipai/shared";
import { MasterAgentGallery, type GalleryAgent, type GalleryTeam } from "./MasterAgentGallery";

vi.mock("@/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string | number>) => {
      if (key === "onboarding.wizard.gallery.hireTeam") return `Hire the ${vars?.department} team`;
      if (key === "onboarding.wizard.gallery.departments.marketing") return "Marketing";
      if (key === "onboarding.wizard.gallery.recommended") return "Recommended";
      if (key === "onboarding.wizard.gallery.hired") return "Hired!";
      if (key === "onboarding.wizard.gallery.selected") return `Selected: ${vars?.name}`;
      if (key === "onboarding.wizard.gallery.lede") return "Pick one role";
      if (key === "onboarding.wizard.gallery.empty") return "No starters";
      return key;
    },
  }),
}));

vi.mock("@/lib/router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

const AGENT_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_A = "22222222-2222-4222-8222-222222222222";
const MEMBER_B = "33333333-3333-4333-8333-333333333333";

const agents: GalleryAgent[] = [
  {
    id: AGENT_ID,
    title: "CMO",
    description: "Owns marketing.",
    icon: "megaphone",
    department: "marketing",
    recommended: true,
  },
];

const teams: GalleryTeam[] = [
  {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Marketing team",
    description: "Full marketing pod",
    department: "marketing",
    memberTitles: ["CMO", "Writer"],
    memberIds: [MEMBER_A, MEMBER_B],
    managerId: MEMBER_A,
  },
];

describe("MasterAgentGallery avatars", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(async () => {
    await act(async () => root?.unmount());
    root = null;
    container.remove();
    document.body.innerHTML = "";
  });

  async function renderGallery(
    onSelect = vi.fn(),
    hiredMasterAgentIds: ReadonlySet<string> = new Set(),
  ) {
    root = createRoot(container);
    await act(async () => {
      root!.render(
        <MasterAgentGallery
          agents={agents}
          teams={teams}
          department="marketing"
          onDepartment={vi.fn()}
          selection={hiredMasterAgentIds.has(AGENT_ID) ? null : { kind: "agent", id: AGENT_ID }}
          onSelect={onSelect}
          modelMissing={false}
          isInstanceAdmin={false}
          error={null}
          hiredMasterAgentIds={hiredMasterAgentIds}
        />,
      );
    });
    return onSelect;
  }

  it("renders a character avatar for each agent row", async () => {
    await renderGallery();
    const expected = agentAvatarUrl(legacyAgentAppearance(AGENT_ID), 32);
    const img = container.querySelector(`img[src="${expected}"]`);
    expect(img).not.toBeNull();
  });

  it("renders stacked member avatars on the team row", async () => {
    await renderGallery();
    const teamButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Hire the Marketing team"),
    );
    expect(teamButton).toBeDefined();
    const srcA = agentAvatarUrl(legacyAgentAppearance(MEMBER_A), 32);
    const srcB = agentAvatarUrl(legacyAgentAppearance(MEMBER_B), 32);
    expect(teamButton!.querySelector(`img[src="${srcA}"]`)).not.toBeNull();
    expect(teamButton!.querySelector(`img[src="${srcB}"]`)).not.toBeNull();
  });

  it("disables hired agents and shows Hired!", async () => {
    const onSelect = await renderGallery(vi.fn(), new Set([AGENT_ID]));
    const agentButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("CMO"),
    );
    expect(agentButton).toBeDefined();
    expect(agentButton!.disabled).toBe(true);
    expect(agentButton!.textContent).toContain("Hired!");
    await act(async () => {
      agentButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).not.toHaveBeenCalled();
  });
});
