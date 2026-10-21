#!/usr/bin/env node
/**
 * Seed a research-first RIKAI migration marketing sample with a full org work tree:
 * - Campaign issue assigned to CMO (LP brief only; no Plan / Approve yet)
 * - Child research issue (in_progress) assigned to Researcher
 * - Writer / Video / Social todo children (waiting on research + CMO plan)
 * - CMO agent chat with an opener pointing at those issues
 *
 * Usage:
 *   pnpm seed:marketing-sample
 *   BASE_URL=http://127.0.0.1:3100 COMPANY_ID=<uuid> pnpm seed:marketing-sample
 *   OPEN_ORG=1 pnpm seed:marketing-sample
 */

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const BASE_URL = (process.env.BASE_URL ?? "http://127.0.0.1:3100").replace(/\/$/, "");
const COMPANY_ID = process.env.COMPANY_ID?.trim() || null;
const OPEN_ORG = process.env.OPEN_ORG === "1" || process.env.OPEN_ORG === "true";
const LP_URL = "https://migration.rikai.technology/rikai-migration/";

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const detail = typeof data === "string" ? data : JSON.stringify(data, null, 2);
    throw new Error(`${method} ${path} → ${res.status}\n${detail}`);
  }
  return data;
}

function findAgentByName(agents, name) {
  return agents.find((a) => a.name === name) ?? null;
}

async function ensureAgent(agents, companyId, name, masterSlug) {
  let agent = findAgentByName(agents, name);
  if (agent) return { agent, agents };
  const masters = await api("GET", "/api/instance/master-agents");
  const master = masters.find((m) => m.slug === masterSlug);
  if (!master) throw new Error(`master-agent ${masterSlug} not found`);
  console.log(`Hiring ${name}…`);
  await api("POST", `/api/companies/${companyId}/onboarding/hires`, {
    masterAgentId: master.id,
  });
  const nextAgents = await api("GET", `/api/companies/${companyId}/agents`);
  agent = findAgentByName(nextAgents, name);
  if (!agent) throw new Error(`${name} missing after hire`);
  return { agent, agents: nextAgents };
}

function openUrl(url) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
}

const CAMPAIGN_DESCRIPTION = [
  `# RIKAI マイグレーションLPキャンペーン`,
  ``,
  `**LP:** ${LP_URL}`,
  ``,
  `## 依頼`,
  `無料簡易診断／移行前20チェックリストへのリード獲得キャンペーンを組み立ててください。価格・期間は断定しないでください。`,
  ``,
  `## CMO への指示`,
  `1. **Researcher** の Web 調査報告を待ってから、ターゲット顧客を定義する`,
  `2. その定義を前提に **Plan** を書き、ボード承認を取る`,
  `3. 承認後に Content Writer / Video Editor / Social Media Manager へ分解タスクを切る`,
  ``,
  `## LP のたたき台（調査前の素材）`,
  `- ヒーロー: 古いコードには、理由がある。その理由を理解してから、次へ。`,
  `- 価値: 仕様書にない業務ロジックまで理解してから移行（COBOL・VB6・メインフレーム等）`,
  `- CTA: 60分無料簡易診断、20チェックリストPDF`,
].join("\n");

const RESEARCH_DESCRIPTION = [
  `# Web 調査｜キーワード・ターゲット顧客 → CMO 報告`,
  ``,
  `**LP（参考）:** ${LP_URL}`,
  ``,
  `インターネットで調査してください（LP だけを読んだ要約では不十分です）。検索・ブラウズを使い、出典 URL を必ず付けてください。`,
  ``,
  `## 調べること`,
  `1. **キーワード / 検索意図（日本語）** — 例: システムマイグレーション, COBOL移行, レガシーモダナイゼーション, AS400移行, 無料診断 など。一次・二次クラスタを整理`,
  `2. **ターゲット顧客仮説** — 業種、企業規模、役割（IT部長 / 情シス / 経営）、トリガー（EOSL、担当退職、保守費増）`,
  `3. **競合・カテゴリ訴求** — 「理解してから移行」／無料診断／日本語窓口との差分`,
  `4. **推奨** — プライマリ／セカンダリ顧客像とキーワードクラスタ`,
  ``,
  `## 成果物`,
  `- マークダウンの調査レポートを **親キャンペーン issue へのコメント**（および／または本 issue）に投稿`,
  `- 宛先は CMO。出典 URL 付き`,
  `- 完了したら本 issue を done にし、CMO が Plan を書ける状態にする`,
].join("\n");

const WAITING_NOTE = [
  ``,
  `## 状態`,
  `リサーチ報告と CMO の Plan／ボード承認を待っています。承認前に本番作業を進めないでください。`,
].join("\n");

const IC_CHILDREN = [
  {
    name: "Content Writer",
    masterSlug: "content-writer",
    title: "コピー｜LPヒーロー・価値訴求・CTA（リサーチ／Plan待ち）",
    description: [
      `# LP コピー（待機）`,
      ``,
      `**LP:** ${LP_URL}`,
      ``,
      `CMO の承認済み Plan と Researcher 報告を受けてから、ヒーロー／価値／CTA のコピーを書いてください。`,
      WAITING_NOTE,
    ].join("\n"),
  },
  {
    name: "Video Editor",
    masterSlug: "video-editor",
    title: "動画｜LP向けショート／解説（リサーチ／Plan待ち）",
    description: [
      `# 動画（待機）`,
      ``,
      `**LP:** ${LP_URL}`,
      ``,
      `CMO の承認済み Plan を受けてから、LP 向けショートまたは解説動画の編集方針を決めてください。`,
      WAITING_NOTE,
    ].join("\n"),
  },
  {
    name: "Social Media Manager",
    masterSlug: "social-media-manager",
    title: "ソーシャル｜投稿・導線（リサーチ／Plan待ち）",
    description: [
      `# ソーシャル（待機）`,
      ``,
      `**LP:** ${LP_URL}`,
      ``,
      `CMO の承認済み Plan を受けてから、投稿カレンダーと LP 導線を組んでください。`,
      WAITING_NOTE,
    ].join("\n"),
  },
];

async function main() {
  console.log(`Seeding marketing sample against ${BASE_URL}`);

  await api("GET", "/api/health");

  const companies = await api("GET", "/api/companies");
  if (!Array.isArray(companies) || companies.length === 0) {
    throw new Error("No companies found. Create a company in the board UI first.");
  }
  const company = COMPANY_ID
    ? companies.find((c) => c.id === COMPANY_ID)
    : [...companies].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0];
  if (!company) throw new Error(`Company not found: ${COMPANY_ID}`);
  console.log(`Company: ${company.name} (${company.issuePrefix}) ${company.id}`);

  let agents = await api("GET", `/api/companies/${company.id}/agents`);
  let cmo = findAgentByName(agents, "CMO");
  if (!cmo) {
    const teams = await api("GET", "/api/instance/master-teams");
    const marketing = teams.find((t) => t.slug === "marketing-team");
    if (!marketing) throw new Error("master-team marketing-team not found");
    console.log("Hiring marketing-team…");
    const hired = await api("POST", `/api/companies/${company.id}/onboarding/hires`, {
      masterTeamId: marketing.id,
    });
    agents = await api("GET", `/api/companies/${company.id}/agents`);
    cmo = agents.find((a) => a.id === hired.managerAgentId) ?? findAgentByName(agents, "CMO");
    if (!cmo) throw new Error("CMO missing after marketing-team hire");
  }
  console.log(`CMO: ${cmo.name} ${cmo.id}`);

  let researcher;
  ({ agent: researcher, agents } = await ensureAgent(agents, company.id, "Researcher", "researcher"));

  if (researcher.reportsTo !== cmo.id) {
    console.log("Nesting Researcher under CMO…");
    researcher = await api("PATCH", `/api/agents/${researcher.id}`, { reportsTo: cmo.id });
  }
  console.log(`Researcher: ${researcher.name} ${researcher.id} → reportsTo ${researcher.reportsTo}`);

  const icAgents = [];
  for (const ic of IC_CHILDREN) {
    let agent;
    ({ agent, agents } = await ensureAgent(agents, company.id, ic.name, ic.masterSlug));
    if (agent.reportsTo !== cmo.id) {
      console.log(`Nesting ${ic.name} under CMO…`);
      agent = await api("PATCH", `/api/agents/${agent.id}`, { reportsTo: cmo.id });
    }
    icAgents.push({ ...ic, agent });
    console.log(`${ic.name}: ${agent.id} → reportsTo ${agent.reportsTo}`);
  }

  const experimental = await api("GET", "/api/instance/settings/experimental");
  if (!experimental.enableAgentChat) {
    console.log("Enabling agent chat…");
    await api("PATCH", "/api/instance/settings/experimental", { enableAgentChat: true });
  }

  const campaign = await api("POST", `/api/companies/${company.id}/issues`, {
    title: "RIKAI マイグレーションLP｜認知〜無料診断リード獲得キャンペーン",
    description: CAMPAIGN_DESCRIPTION,
    status: "todo",
    assigneeAgentId: cmo.id,
  });
  console.log(`Campaign: ${campaign.identifier} ${campaign.id}`);

  const research = await api("POST", `/api/companies/${company.id}/issues`, {
    title: "リサーチ｜キーワード・ターゲット顧客のWeb調査とCMO報告",
    description: RESEARCH_DESCRIPTION,
    status: "in_progress",
    parentId: campaign.id,
    assigneeAgentId: researcher.id,
  });
  console.log(`Research: ${research.identifier} ${research.id} (in_progress)`);

  for (const ic of icAgents) {
    const child = await api("POST", `/api/companies/${company.id}/issues`, {
      title: ic.title,
      description: ic.description,
      status: "todo",
      parentId: campaign.id,
      assigneeAgentId: ic.agent.id,
    });
    console.log(`${ic.name} task: ${child.identifier} ${child.id}`);
  }

  const chat = await api("POST", `/api/companies/${company.id}/chats/${cmo.id}`, {});
  const chatIssue = chat?.issue ?? chat;
  const chatId = chatIssue?.id ?? chat?.id;
  if (!chatId) throw new Error(`Unexpected chat response: ${JSON.stringify(chat)}`);

  const opener = [
    `キャンペーン ${campaign.identifier} を開始しました。`,
    ``,
    `1. Researcher が ${research.identifier} で Web 調査（キーワード・ターゲット顧客・競合）し、キャンペーンへ報告するのを待つ`,
    `2. 報告を踏まえてターゲット顧客を定義し、Plan を書いてボード承認を取る`,
    `3. 承認後に Writer / Video / Social の待機タスクを本作業へ切り替える`,
    ``,
    `Org Work flow: /${company.issuePrefix}/agents/all?workIssue=${campaign.id}`,
    ``,
    `LP: ${LP_URL}`,
  ].join("\n");

  await api("POST", `/api/issues/${chatId}/comments`, {
    body: opener,
    clientRequestId: randomUUID(),
  });
  console.log(`CMO chat issue: ${chatIssue.identifier ?? chatId}`);

  const campaignUrl = `${BASE_URL}/${company.issuePrefix}/issues/${campaign.identifier}`;
  const researchUrl = `${BASE_URL}/${company.issuePrefix}/issues/${research.identifier}`;
  const chatUrl = `${BASE_URL}/${company.issuePrefix}/chats/${cmo.id}`;
  const orgWorkUrl = `${BASE_URL}/${company.issuePrefix}/agents/all?workIssue=${campaign.id}`;

  console.log("");
  console.log("Open:");
  console.log(`  Campaign:       ${campaignUrl}`);
  console.log(`  Research:       ${researchUrl}`);
  console.log(`  CMO chat:       ${chatUrl}`);
  console.log(`  Org Work flow:  ${orgWorkUrl}`);
  console.log("    → Agents → Org chart → Work flow stays ON");
  console.log("");
  console.log("Next: open the research issue and Run the Researcher (needs adapter + web tools).");
  console.log("After the report lands on the campaign, CMO drafts Plan → Approve → IC children.");

  if (OPEN_ORG) {
    console.log(`Opening Org Work flow (${OPEN_ORG ? "OPEN_ORG=1" : ""})…`);
    openUrl(orgWorkUrl);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
