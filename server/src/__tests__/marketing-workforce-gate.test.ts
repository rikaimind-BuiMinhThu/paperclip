import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  companies,
  createDb,
  documents,
  issueDocuments,
  issueThreadInteractions,
  issues,
} from "@paperclipai/db";
import { HttpError } from "../errors.js";
import { assertMarketingPlanningAllowed } from "../services/marketing-workforce-gate.js";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported
  ? describe
  : describe.skip;

describeEmbeddedPostgres("assertMarketingPlanningAllowed", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<
    ReturnType<typeof startEmbeddedPostgresTestDatabase>
  > | null = null;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase(
      "paperclip-marketing-workforce-gate-",
    );
    db = createDb(tempDb.connectionString);
  }, 60_000);

  afterEach(async () => {
    await db.delete(issueThreadInteractions);
    await db.delete(issueDocuments);
    await db.delete(documents);
    await db.delete(issues);
    await db.delete(companies);
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  async function seedCampaign(opts?: { confirmed?: boolean }) {
    const companyId = randomUUID();
    const parentId = randomUUID();
    const documentId = randomUUID();

    await db.insert(companies).values({
      id: companyId,
      name: "Marketing Co",
      issuePrefix: "MKT",
      defaultResponsibleUserId: "board-user",
    });

    await db.insert(issues).values({
      id: parentId,
      companyId,
      title: "Campaign: Japan launch",
      status: "in_review",
      priority: "medium",
      executionPolicy: {
        marketingWorkforce: { workflowId: "WF-01", phase: "discovery" },
      },
    });

    await db.insert(documents).values({
      id: documentId,
      companyId,
      title: "requirement_state",
      latestBody: "{}",
      format: "markdown",
    });

    await db.insert(issueDocuments).values({
      id: randomUUID(),
      companyId,
      issueId: parentId,
      documentId,
      key: "requirement_state",
    });

    if (opts?.confirmed) {
      await db.insert(issueThreadInteractions).values({
        id: randomUUID(),
        companyId,
        issueId: parentId,
        kind: "request_checkbox_confirmation",
        status: "accepted",
        payload: {
          version: 1,
          prompt: "Approve the requirement brief?",
          options: [
            {
              id: "approve",
              label: "Approve requirement brief",
            },
          ],
          target: {
            type: "issue_document",
            issueId: parentId,
            documentId: randomUUID(),
            key: "requirement_brief",
            revisionId: randomUUID(),
            revisionNumber: 1,
            label: "Requirement brief",
            href: "#document-requirement_brief",
          },
        } as never,
      });
    }

    return { companyId, parentId };
  }

  it("allows non-marketing children without checks", async () => {
    const { companyId, parentId } = await seedCampaign();
    await expect(
      assertMarketingPlanningAllowed({
        db,
        companyId,
        parentId,
        childExecutionPolicy: {},
      }),
    ).resolves.toBeUndefined();
  });

  it("blocks WF-03 children when brief is unconfirmed", async () => {
    const { companyId, parentId } = await seedCampaign({ confirmed: false });
    await expect(
      assertMarketingPlanningAllowed({
        db,
        companyId,
        parentId,
        childExecutionPolicy: {
          marketingWorkforce: { workflowId: "WF-03" },
        },
      }),
    ).rejects.toMatchObject({
      status: 422,
      details: { code: "marketing_requirement_brief_unconfirmed" },
    } satisfies Partial<HttpError>);
  });

  it("allows WF-03 children after brief confirmation", async () => {
    const { companyId, parentId } = await seedCampaign({ confirmed: true });
    await expect(
      assertMarketingPlanningAllowed({
        db,
        companyId,
        parentId,
        childExecutionPolicy: {
          marketingWorkforce: { workflowId: "WF-03", phase: "planning" },
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("blocks WF-04 until marketing_strategy is confirmed", async () => {
    const { companyId, parentId } = await seedCampaign({ confirmed: true });
    await expect(
      assertMarketingPlanningAllowed({
        db,
        companyId,
        parentId,
        childExecutionPolicy: {
          marketingWorkforce: { workflowId: "WF-04", phase: "execution" },
        },
      }),
    ).rejects.toMatchObject({
      status: 422,
      details: { code: "marketing_strategy_unconfirmed" },
    });
  });

  async function acceptDocument(companyId: string, parentId: string, key: string) {
    await db.insert(issueThreadInteractions).values({
      id: randomUUID(),
      companyId,
      issueId: parentId,
      kind: "request_checkbox_confirmation",
      status: "accepted",
      payload: {
        version: 1,
        prompt: `Approve ${key}?`,
        options: [{ id: "approve", label: "Approve" }],
        target: {
          type: "issue_document",
          issueId: parentId,
          documentId: randomUUID(),
          key,
          revisionId: randomUUID(),
          revisionNumber: 1,
          label: key,
          href: `#document-${key}`,
        },
      } as never,
    });
  }

  it("blocks unauthorized publish actions", async () => {
    const { companyId, parentId } = await seedCampaign({ confirmed: true });
    await acceptDocument(companyId, parentId, "marketing_strategy");
    await expect(
      assertMarketingPlanningAllowed({
        db,
        companyId,
        parentId,
        childExecutionPolicy: {
          marketingWorkforce: {
            workflowId: "WF-05",
            phase: "execution",
            externalAction: "publish",
          },
        },
      }),
    ).rejects.toMatchObject({
      status: 422,
      details: { code: "marketing_external_action_unauthorized" },
    });
  });

  it("blocks unauthorized spend actions", async () => {
    const { companyId, parentId } = await seedCampaign({ confirmed: true });
    await acceptDocument(companyId, parentId, "marketing_strategy");
    await expect(
      assertMarketingPlanningAllowed({
        db,
        companyId,
        parentId,
        childExecutionPolicy: {
          marketingWorkforce: {
            workflowId: "WF-05",
            phase: "execution",
            externalAction: "spend",
          },
        },
      }),
    ).rejects.toMatchObject({
      status: 422,
      details: {
        code: "marketing_external_action_unauthorized",
        documentKey: "spend_authorization",
      },
    });
  });

  it("allows publish after publish_authorization is confirmed", async () => {
    const { companyId, parentId } = await seedCampaign({ confirmed: true });
    await acceptDocument(companyId, parentId, "marketing_strategy");
    await acceptDocument(companyId, parentId, "publish_authorization");
    await expect(
      assertMarketingPlanningAllowed({
        db,
        companyId,
        parentId,
        childExecutionPolicy: {
          marketingWorkforce: {
            workflowId: "WF-05",
            phase: "execution",
            externalAction: "publish",
          },
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("blocks gated children without a parent", async () => {
    const companyId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Marketing Co",
      issuePrefix: "MKT",
      defaultResponsibleUserId: "board-user",
    });
    await expect(
      assertMarketingPlanningAllowed({
        db,
        companyId,
        parentId: null,
        childExecutionPolicy: {
          marketingWorkforce: { workflowId: "WF-02" },
        },
      }),
    ).rejects.toMatchObject({
      status: 422,
      details: { code: "marketing_requirement_brief_required" },
    });
  });
});
