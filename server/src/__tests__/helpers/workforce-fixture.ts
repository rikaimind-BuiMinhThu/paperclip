import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { agents, companies, createDb } from "@paperclipai/db";
import { afterAll, beforeAll, beforeEach, describe } from "vitest";
import { workforceWorkflowService } from "../../services/workforce/workflow-engine.js";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./embedded-postgres.js";

const support = await getEmbeddedPostgresTestSupport();
export const describeWorkforce = support.supported ? describe : describe.skip;

type Db = ReturnType<typeof createDb>;

export function useWorkforceDb(prefix: string) {
  let db!: Db;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  const previousSecret = process.env.PAPERCLIP_TOOL_ACTION_SIGNING_SECRET;

  beforeAll(async () => {
    process.env.PAPERCLIP_TOOL_ACTION_SIGNING_SECRET = "workforce-test-signing-secret";
    tempDb = await startEmbeddedPostgresTestDatabase(prefix);
    db = createDb(tempDb.connectionString);
  }, 30_000);

  beforeEach(async () => {
    await db.execute(sql`truncate table companies cascade`);
  });

  afterAll(async () => {
    await db?.$client.end({ timeout: 1 }).catch(() => {});
    await tempDb?.cleanup();
    if (previousSecret === undefined) delete process.env.PAPERCLIP_TOOL_ACTION_SIGNING_SECRET;
    else process.env.PAPERCLIP_TOOL_ACTION_SIGNING_SECRET = previousSecret;
  });

  return {
    get db() {
      return db;
    },
  };
}

export async function seedWorkforceCompany(db: Db, name: string, lifecycle?: "draft") {
  const companyId = randomUUID();
  const agentId = randomUUID();
  await db.insert(companies).values({
    id: companyId,
    name,
    issuePrefix: `T${companyId.replaceAll("-", "").slice(0, 6).toUpperCase()}`,
    requireBoardApprovalForNewAgents: false,
    defaultResponsibleUserId: "board-user",
  });
  await db.insert(agents).values({
    id: agentId,
    companyId,
    name: `${name} employee`,
    status: "idle",
    metadata: lifecycle ? { workforce: { lifecycle } } : {},
  });
  return { companyId, agentId };
}

export function workflowSvc(db: Db) {
  return workforceWorkflowService(db, {
    storeFile: async () => ({
      provider: "local",
      objectKey: `workforce/${randomUUID()}.html`,
      contentType: "text/html",
      byteSize: 32,
      sha256: "a".repeat(64),
      originalFilename: "shift-report.html",
    }),
  });
}
