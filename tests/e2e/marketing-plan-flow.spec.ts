import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Marketing plan UI contract (deterministic, no live LLM):
 * hire Marketing team → seed plan + confirmation → Approve in UI →
 * child issues for Writer / Video / Social → org Work flow badges.
 */

test.use({ trace: "retain-on-failure" });
test.setTimeout(180_000);

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<T>;
}

test("marketing plan approve creates children and lights org work flow", async ({
  page,
  request,
}) => {
  const company = await json<{ id: string; issuePrefix: string }>(
    await request.post("/api/companies", {
      data: { name: `Marketing Plan E2E ${Date.now()}` },
    }),
  );

  const teams = await json<Array<{ id: string; slug: string; members: Array<{ title: string }> }>>(
    await request.get("/api/instance/master-teams"),
  );
  const marketing = teams.find((team) => team.slug === "marketing-team");
  expect(marketing).toBeTruthy();
  expect(marketing!.members).toHaveLength(4);

  const hired = await json<{
    agents: Array<{ id: string; name: string; reportsTo: string | null }>;
    managerAgentId: string;
  }>(
    await request.post(`/api/companies/${company.id}/onboarding/hires`, {
      data: { masterTeamId: marketing!.id },
    }),
  );
  expect(hired.agents).toHaveLength(4);
  const cmo = hired.agents.find((agent) => agent.id === hired.managerAgentId)!;
  const writer = hired.agents.find((agent) => agent.name === "Content Writer")!;
  const video = hired.agents.find((agent) => agent.name === "Video Editor")!;
  const social = hired.agents.find((agent) => agent.name === "Social Media Manager")!;
  expect(cmo.reportsTo).toBeNull();
  expect([writer, video, social].every((agent) => agent.reportsTo === cmo.id)).toBe(true);

  const campaign = await json<{ id: string; identifier: string }>(
    await request.post(`/api/companies/${company.id}/issues`, {
      data: {
        title: "Spring launch campaign",
        description: "Ship a coordinated marketing push.",
        status: "todo",
        assigneeAgentId: cmo.id,
      },
    }),
  );

  const plan = await json<{ latestRevisionId: string; latestRevisionNumber: number; body: string }>(
    await request.put(`/api/issues/${campaign.id}/documents/plan`, {
      data: {
        title: "Plan",
        format: "markdown",
        body: [
          "# Spring launch",
          "",
          "- Content Writer: landing page copy",
          "- Video Editor: 30s launch cut",
          "- Social Media Manager: announce on social",
        ].join("\n"),
      },
    }),
  );
  expect(plan.body).toContain("Spring launch");

  await json(
    await request.post(`/api/issues/${campaign.id}/interactions`, {
      data: {
        kind: "request_confirmation",
        continuationPolicy: "wake_assignee",
        payload: {
          version: 1,
          prompt: "Approve this marketing plan and create child tasks?",
          acceptLabel: "Approve plan",
          rejectLabel: "Revise",
          rejectRequiresReason: true,
          target: {
            type: "issue_document",
            key: "plan",
            revisionId: plan.latestRevisionId,
            revisionNumber: plan.latestRevisionNumber,
          },
        },
      },
    }),
  );

  await page.goto(`/${company.issuePrefix}/issues/${campaign.identifier}`);
  await expect(page.getByRole("tab", { name: "Plan", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await expect(
    page.getByTestId("document-annotation-body-plan").getByRole("heading", { name: "Spring launch" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Approve plan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Approve plan", exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });

  // Deterministic post-approve child creation (skill-driven in production).
  for (const child of [
    { title: "Write landing copy", assigneeAgentId: writer.id },
    { title: "Cut launch video", assigneeAgentId: video.id },
    { title: "Schedule social posts", assigneeAgentId: social.id },
  ]) {
    await json(
      await request.post(`/api/companies/${company.id}/issues`, {
        data: {
          title: child.title,
          status: "todo",
          parentId: campaign.id,
          assigneeAgentId: child.assigneeAgentId,
        },
      }),
    );
  }

  const issues = await json<Array<{ id: string; parentId: string | null; assigneeAgentId: string | null; title: string }>>(
    await request.get(`/api/companies/${company.id}/issues`),
  );
  const children = issues.filter((issue) => issue.parentId === campaign.id);
  expect(children).toHaveLength(3);
  expect(new Set(children.map((issue) => issue.assigneeAgentId))).toEqual(
    new Set([writer.id, video.id, social.id]),
  );
  expect(issues.find((issue) => issue.id === campaign.id)?.assigneeAgentId).toBe(cmo.id);

  // Streamlined UI hosts OrgChart on Agents; default locale is Japanese.
  await page.goto(`/${company.issuePrefix}/agents/all?workIssue=${campaign.id}`);
  await page.getByRole("button", { name: /Org chart view|組織図表示/i }).click();
  await expect(page.getByTestId("org-chart-viewport")).toBeVisible({ timeout: 30_000 });
  const workFlow = page.getByTestId("org-work-flow-toggle");
  await expect(workFlow).toBeVisible({ timeout: 30_000 });
  if ((await workFlow.getAttribute("aria-pressed")) !== "true") {
    await workFlow.click();
  }
  await expect(page.getByTestId(`org-work-badge-${writer.id}`)).toHaveText("1");
  await expect(page.getByTestId(`org-work-badge-${video.id}`)).toHaveText("1");
  await expect(page.getByTestId(`org-work-badge-${social.id}`)).toHaveText("1");
  await expect(page.getByTestId(`org-work-flow-edge-${writer.id}`)).toBeVisible();
});
