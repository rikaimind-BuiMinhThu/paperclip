import type { WorkforceGraph } from "./validators/workforce-workflow.js";

export const SACHI_DAILY_WORKFLOW_GRAPH: WorkforceGraph = {
  nodes: [
    { id: "start", type: "start" },
    { id: "employee", type: "employee", agentSource: "routine_assignee" },
    { id: "draft", type: "tool", tool: "workforce.outbound_message", mode: "draft" },
    { id: "approve", type: "approval", bindsNodeId: "draft" },
    { id: "send", type: "tool", tool: "workforce.outbound_message", mode: "send", bindsNodeId: "approve" },
    { id: "crm", type: "tool", tool: "workforce.crm_record" },
    { id: "report", type: "artifact", format: "html" },
    { id: "end", type: "end" },
  ],
  edges: [
    { from: "start", to: "employee" },
    { from: "employee", to: "draft" },
    { from: "draft", to: "approve" },
    { from: "approve", to: "send" },
    { from: "send", to: "crm" },
    { from: "crm", to: "report" },
    { from: "report", to: "end" },
  ],
};

export const SACHI_ROUTINE_CRON = "0 9 * * 1-5";
export const SACHI_ROUTINE_TIMEZONE = "Asia/Tokyo";

export const KUJIRA_EMPLOYEE_TEMPLATES = [
  {
    slug: "sachi-sales",
    title: "Sales AI",
    department: "sales" as const,
    role: "general" as const,
    description: "Sachi drafts outreach from approved CRM and mail context.",
    instructions: "You are {{agentName}}, Sales AI for {{organizationName}}. Read approved CRM and mail context, qualify leads, and draft outreach. Never send email without human approval. Never post publicly.",
    icon: "megaphone",
    sortOrder: 20,
  },
  {
    slug: "ikura-back-office",
    title: "Back Office AI",
    department: "back-office" as const,
    role: "general" as const,
    description: "Ikura drafts invoices and tracks payment status.",
    instructions: "You are {{agentName}}, Back Office AI for {{organizationName}}. Draft invoices and payment schedules. Financial actions require human approval. Never move funds. Never create a second invoice for the same idempotency key.",
    icon: "receipt",
    sortOrder: 20,
  },
  {
    slug: "kujira-engineer",
    title: "Engineer",
    department: "engineering" as const,
    role: "engineer" as const,
    description: "Plans engineering work and delegates inside an isolated workspace.",
    instructions: "You are {{agentName}}, Engineer for {{organizationName}}. Plan work, inspect the repository, and delegate inside the company. No production deploy without approval. Use the existing execution workspace.",
    icon: "code",
    sortOrder: 20,
  },
];
