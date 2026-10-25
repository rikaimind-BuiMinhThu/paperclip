import { z } from "zod";

/** Marketing lifecycle workflow identifiers. */
export const MARKETING_WORKFLOW_IDS = [
  "WF-01",
  "WF-02",
  "WF-03",
  "WF-04",
  "WF-05",
  "WF-06",
  "WF-07",
  "WF-08",
] as const;

export type MarketingWorkflowId = (typeof MARKETING_WORKFLOW_IDS)[number];

/** Workflows that require an approved requirement brief on the campaign parent. */
export const MARKETING_PLANNING_WORKFLOW_IDS = [
  "WF-02",
  "WF-03",
  "WF-04",
  "WF-05",
  "WF-06",
  "WF-07",
  "WF-08",
] as const satisfies ReadonlyArray<MarketingWorkflowId>;

export const MARKETING_REQUIREMENT_DOCUMENT_KEYS = {
  state: "requirement_state",
  brief: "requirement_brief",
  strategy: "marketing_strategy",
  publishAuthorization: "publish_authorization",
  spendAuthorization: "spend_authorization",
  outboundAuthorization: "outbound_authorization",
} as const;

export const MARKETING_WORKFORCE_PHASES = [
  "discovery",
  "planning",
  "execution",
] as const;

export type MarketingWorkforcePhase = (typeof MARKETING_WORKFORCE_PHASES)[number];

/** Consequential external actions that require explicit human authorization. */
export const MARKETING_EXTERNAL_ACTIONS = [
  "publish",
  "spend",
  "outbound",
] as const;

export type MarketingExternalAction = (typeof MARKETING_EXTERNAL_ACTIONS)[number];

export const MARKETING_EXTERNAL_ACTION_DOCUMENT_KEYS = {
  publish: MARKETING_REQUIREMENT_DOCUMENT_KEYS.publishAuthorization,
  spend: MARKETING_REQUIREMENT_DOCUMENT_KEYS.spendAuthorization,
  outbound: MARKETING_REQUIREMENT_DOCUMENT_KEYS.outboundAuthorization,
} as const satisfies Record<MarketingExternalAction, string>;

/** Workflows that should wait for an approved marketing strategy on the parent. */
export const MARKETING_STRATEGY_GATED_WORKFLOW_IDS = [
  "WF-04",
  "WF-05",
  "WF-06",
  "WF-07",
  "WF-08",
] as const satisfies ReadonlyArray<MarketingWorkflowId>;

export const marketingWorkforceMarkerSchema = z
  .object({
    workflowId: z.enum(MARKETING_WORKFLOW_IDS),
    phase: z.enum(MARKETING_WORKFORCE_PHASES).optional(),
    externalAction: z.enum(MARKETING_EXTERNAL_ACTIONS).optional(),
  })
  .strict();

export type MarketingWorkforceMarker = z.infer<typeof marketingWorkforceMarkerSchema>;

export function requiresMarketingStrategyApproval(
  marker: MarketingWorkforceMarker | null | undefined,
): boolean {
  if (!marker) return false;
  return (MARKETING_STRATEGY_GATED_WORKFLOW_IDS as readonly string[]).includes(
    marker.workflowId,
  );
}

export function requiredAuthorizationDocumentKey(
  marker: MarketingWorkforceMarker | null | undefined,
): string | null {
  if (!marker?.externalAction) return null;
  return MARKETING_EXTERNAL_ACTION_DOCUMENT_KEYS[marker.externalAction];
}

/** Standard unavailable integration payload when credentials/APIs are missing. */
export function marketingIntegrationUnavailable(args: {
  integration: string;
  requiredFields?: string[];
  reason?: string;
}): {
  status: "not_configured";
  integration: string;
  requiredFields: string[];
  reason: string;
} {
  return {
    status: "not_configured",
    integration: args.integration,
    requiredFields: args.requiredFields ?? [],
    reason:
      args.reason ??
      `${args.integration} is not configured for this company. Connect credentials before execution.`,
  };
}

export const MARKETING_REQUIREMENT_STATUSES = [
  "created",
  "interviewing",
  "pending_confirmation",
  "confirmed",
  "blocked",
  "cancelled",
] as const;

export type MarketingRequirementStatus =
  (typeof MARKETING_REQUIREMENT_STATUSES)[number];

export const MARKETING_APPROVAL_STATUSES = [
  "not_requested",
  "pending",
  "approved",
  "rejected",
  "changes_requested",
] as const;

export const MARKETING_UNKNOWN_CLASSIFICATIONS = [
  "research_required",
  "decision_pending",
  "optional_unknown",
] as const;

export type MarketingUnknownClassification =
  (typeof MARKETING_UNKNOWN_CLASSIFICATIONS)[number];

/** Interview category ids collected during WF-01. */
export const MARKETING_INTERVIEW_CATEGORIES = [
  "business_context",
  "product",
  "objectives",
  "target_customers",
  "current_situation",
  "budget",
  "timeline",
  "success_criteria",
  "constraints",
  "automation_permissions",
] as const;

export type MarketingInterviewCategory =
  (typeof MARKETING_INTERVIEW_CATEGORIES)[number];

export const marketingObjectiveKinds = [
  "brand_awareness",
  "qualified_leads",
  "product_sales",
  "validate_demand",
  "multiple",
  "other",
] as const;

export type MarketingObjectiveKind = (typeof marketingObjectiveKinds)[number];

const unknownItemSchema = z
  .object({
    category: z.enum(MARKETING_INTERVIEW_CATEGORIES),
    classification: z.enum(MARKETING_UNKNOWN_CLASSIFICATIONS),
    note: z.string().max(2000).optional(),
  })
  .strict();

const questionHistoryEntrySchema = z
  .object({
    id: z.string().min(1).max(120),
    category: z.enum(MARKETING_INTERVIEW_CATEGORIES),
    prompt: z.string().min(1).max(4000),
    askedAt: z.string().datetime(),
    answerRaw: z.string().max(10000).optional(),
    selectedOptionIds: z.array(z.string().max(120)).max(32).optional(),
    parsedKind: z
      .enum([
        "option_ids",
        "free_form",
        "unknown",
        "recommend",
        "multi_option",
      ])
      .optional(),
  })
  .strict();

const nextQuestionSchema = z
  .object({
    id: z.string().min(1).max(120),
    category: z.enum(MARKETING_INTERVIEW_CATEGORIES),
    prompt: z.string().min(1).max(4000),
    answerMode: z.enum(["single_select", "multi_select", "text"]),
    options: z
      .array(
        z
          .object({
            id: z.string().min(1).max(120),
            label: z.string().min(1).max(500),
            freeText: z.boolean().optional(),
          })
          .strict(),
      )
      .max(12)
      .optional(),
  })
  .strict();

export const marketingRequirementStateSchema = z
  .object({
    schema: z.literal("paperclip.marketing_requirement_state.v1"),
    workflowId: z.literal("WF-01"),
    status: z.enum(MARKETING_REQUIREMENT_STATUSES),
    version: z.number().int().positive().default(1),
    businessContext: z.record(z.string(), z.unknown()).default({}),
    product: z.record(z.string(), z.unknown()).default({}),
    objectives: z.array(z.unknown()).default([]),
    objectiveKinds: z.array(z.enum(marketingObjectiveKinds)).default([]),
    targetCustomers: z.array(z.unknown()).default([]),
    currentSituation: z.record(z.string(), z.unknown()).default({}),
    budget: z.record(z.string(), z.unknown()).default({}),
    timeline: z.record(z.string(), z.unknown()).default({}),
    successCriteria: z.array(z.unknown()).default([]),
    constraints: z.array(z.unknown()).default([]),
    assumptions: z.array(z.unknown()).default([]),
    automationPermissions: z.record(z.string(), z.unknown()).default({}),
    answeredCategories: z
      .array(z.enum(MARKETING_INTERVIEW_CATEGORIES))
      .default([]),
    researchRequired: z.array(unknownItemSchema).default([]),
    decisionPending: z.array(unknownItemSchema).default([]),
    optionalUnknown: z.array(unknownItemSchema).default([]),
    questionHistory: z.array(questionHistoryEntrySchema).default([]),
    nextQuestion: nextQuestionSchema.nullable().default(null),
    approvalStatus: z.enum(MARKETING_APPROVAL_STATUSES).default("not_requested"),
    updatedAt: z.string().datetime().optional(),
  })
  .strict();

export type MarketingRequirementState = z.infer<
  typeof marketingRequirementStateSchema
>;

export type MarketingNextQuestion = z.infer<typeof nextQuestionSchema>;

export function createEmptyMarketingRequirementState(
  overrides: Partial<MarketingRequirementState> = {},
): MarketingRequirementState {
  return marketingRequirementStateSchema.parse({
    schema: "paperclip.marketing_requirement_state.v1",
    workflowId: "WF-01",
    status: "interviewing",
    version: 1,
    ...overrides,
  });
}

/** Primary objective kinds that steer adaptive question order. */
export function primaryObjectiveKind(
  state: Pick<MarketingRequirementState, "objectiveKinds">,
): MarketingObjectiveKind | null {
  return state.objectiveKinds[0] ?? null;
}

/**
 * Category priority by primary objective. Critical categories always precede
 * optional ones so a brief can be reached without forcing budget/timeline.
 * Lead-gen paths prioritize product + ICP; awareness prioritizes context + audience.
 */
export function interviewCategoryPriority(
  objective: MarketingObjectiveKind | null,
): MarketingInterviewCategory[] {
  const optionalTail: MarketingInterviewCategory[] = [
    "current_situation",
    "budget",
    "timeline",
    "constraints",
    "automation_permissions",
  ];

  const leadGenCritical: MarketingInterviewCategory[] = [
    "objectives",
    "product",
    "business_context",
    "target_customers",
    "success_criteria",
  ];
  const awarenessCritical: MarketingInterviewCategory[] = [
    "objectives",
    "business_context",
    "product",
    "target_customers",
    "success_criteria",
  ];
  const salesCritical: MarketingInterviewCategory[] = [
    "objectives",
    "product",
    "target_customers",
    "business_context",
    "success_criteria",
  ];

  switch (objective) {
    case "qualified_leads":
      return [...leadGenCritical, ...optionalTail];
    case "brand_awareness":
      return [...awarenessCritical, ...optionalTail];
    case "product_sales":
    case "validate_demand":
      return [...salesCritical, ...optionalTail];
    case "multiple":
    case "other":
    case null:
      return [...leadGenCritical, ...optionalTail];
    default: {
      const _exhaustive: never = objective;
      return _exhaustive;
    }
  }
}

/** Categories that must be answered (or classified unknown) before a brief. */
export const MARKETING_CRITICAL_CATEGORIES: MarketingInterviewCategory[] = [
  "objectives",
  "product",
  "business_context",
  "target_customers",
  "success_criteria",
];

export function isCategorySatisfied(
  state: MarketingRequirementState,
  category: MarketingInterviewCategory,
): boolean {
  if (state.answeredCategories.includes(category)) return true;
  const unknownPools = [
    ...state.researchRequired,
    ...state.decisionPending,
    ...state.optionalUnknown,
  ];
  return unknownPools.some((item) => item.category === category);
}

export function missingCriticalCategories(
  state: MarketingRequirementState,
): MarketingInterviewCategory[] {
  return MARKETING_CRITICAL_CATEGORIES.filter(
    (category) => !isCategorySatisfied(state, category),
  );
}

export function isRequirementBriefReady(
  state: MarketingRequirementState,
): boolean {
  return missingCriticalCategories(state).length === 0;
}

const OBJECTIVE_QUESTION: MarketingNextQuestion = {
  id: "q_objectives_primary",
  category: "objectives",
  prompt:
    "Before preparing a marketing plan, I would like to clarify your business objective.\n\nWhat is your primary goal?",
  answerMode: "multi_select",
  options: [
    { id: "brand_awareness", label: "Build brand awareness." },
    { id: "qualified_leads", label: "Generate qualified leads." },
    { id: "product_sales", label: "Increase product sales." },
    { id: "validate_demand", label: "Validate market demand." },
    { id: "multiple", label: "Combine multiple objectives." },
    { id: "other", label: "Other.", freeText: true },
    { id: "unknown", label: "I don't know." },
    { id: "recommend", label: "Recommend the best option." },
  ],
};

const CATEGORY_QUESTION_BANK: Record<
  Exclude<MarketingInterviewCategory, "objectives">,
  MarketingNextQuestion
> = {
  business_context: {
    id: "q_business_context",
    category: "business_context",
    prompt: "What is the business or company context for this marketing work?",
    answerMode: "single_select",
    options: [
      { id: "b2b_saas", label: "B2B SaaS / software." },
      { id: "b2c_product", label: "B2C product or consumer brand." },
      { id: "services", label: "Services / agency." },
      { id: "marketplace", label: "Marketplace / platform." },
      { id: "other", label: "Other.", freeText: true },
      { id: "unknown", label: "I don't know." },
    ],
  },
  product: {
    id: "q_product",
    category: "product",
    prompt: "What product or service are we marketing?",
    answerMode: "text",
  },
  target_customers: {
    id: "q_target_customers",
    category: "target_customers",
    prompt:
      "Who is the primary target customer (ICP), and which market or region matters most?",
    answerMode: "text",
  },
  current_situation: {
    id: "q_current_situation",
    category: "current_situation",
    prompt: "What is the current marketing situation?",
    answerMode: "single_select",
    options: [
      { id: "none", label: "Little or no marketing yet." },
      { id: "organic", label: "Mostly organic / content." },
      { id: "paid", label: "Active paid campaigns." },
      { id: "mixed", label: "Mix of organic and paid." },
      { id: "other", label: "Other.", freeText: true },
      { id: "unknown", label: "I don't know — research it." },
    ],
  },
  budget: {
    id: "q_budget",
    category: "budget",
    prompt: "What budget and resources can we use?",
    answerMode: "single_select",
    options: [
      { id: "none", label: "No paid budget (organic only)." },
      { id: "under_5k", label: "Under $5k / month." },
      { id: "5k_20k", label: "$5k–$20k / month." },
      { id: "over_20k", label: "Over $20k / month." },
      { id: "other", label: "Other.", freeText: true },
      { id: "unknown", label: "I don't know / decide later." },
    ],
  },
  timeline: {
    id: "q_timeline",
    category: "timeline",
    prompt: "What is the target timeline?",
    answerMode: "single_select",
    options: [
      { id: "2_weeks", label: "Within 2 weeks." },
      { id: "1_month", label: "About 1 month." },
      { id: "1_quarter", label: "This quarter." },
      { id: "flexible", label: "Flexible." },
      { id: "other", label: "Other.", freeText: true },
      { id: "unknown", label: "I don't know." },
    ],
  },
  success_criteria: {
    id: "q_success_criteria",
    category: "success_criteria",
    prompt: "How will we measure success (KPIs)?",
    answerMode: "text",
  },
  constraints: {
    id: "q_constraints",
    category: "constraints",
    prompt: "Any hard constraints or risks we must respect?",
    answerMode: "text",
  },
  automation_permissions: {
    id: "q_automation_permissions",
    category: "automation_permissions",
    prompt: "What may the marketing workforce do without asking you each time?",
    answerMode: "multi_select",
    options: [
      { id: "internal_research", label: "Internal research only." },
      { id: "draft_content", label: "Draft content (no publish)." },
      { id: "publish_preauth", label: "Publish when pre-authorized." },
      { id: "paid_spend", label: "Spend advertising budget within limits." },
      { id: "outbound", label: "Outbound customer messages." },
      { id: "none", label: "Ask me before any external action." },
    ],
  },
};

/**
 * Pick the next most valuable interview question. Skips categories already
 * answered or classified as unknown. Returns null when the brief is ready.
 */
export function selectNextInterviewQuestion(
  state: MarketingRequirementState,
): MarketingNextQuestion | null {
  if (isRequirementBriefReady(state)) return null;

  const askedIds = new Set(state.questionHistory.map((entry) => entry.id));
  const priority = interviewCategoryPriority(primaryObjectiveKind(state));

  for (const category of priority) {
    if (isCategorySatisfied(state, category)) continue;

    if (category === "objectives") {
      if (!askedIds.has(OBJECTIVE_QUESTION.id)) return OBJECTIVE_QUESTION;
      // Already asked but not satisfied — re-ask with same card only if not in history satisfaction path
      if (!state.answeredCategories.includes("objectives")) {
        return OBJECTIVE_QUESTION;
      }
      continue;
    }

    const question = CATEGORY_QUESTION_BANK[category];
    if (askedIds.has(question.id) && isCategorySatisfied(state, category)) {
      continue;
    }
    if (askedIds.has(question.id)) {
      // Avoid repeating the same question id forever; mark optional unknown instead.
      continue;
    }
    return question;
  }

  return null;
}

export type ParsedInterviewAnswerKind =
  | "option_ids"
  | "multi_option"
  | "free_form"
  | "unknown"
  | "recommend";

export interface ParsedInterviewAnswer {
  kind: ParsedInterviewAnswerKind;
  /** Option ids resolved from numbered choices or known option ids. */
  selectedOptionIds: string[];
  /** Free-form text when the user typed a narrative answer. */
  freeText: string | null;
  /** 1-based indices the user typed (for debugging / history). */
  selectedNumbers: number[];
}

const UNKNOWN_PATTERNS =
  /^(i\s*don'?t\s*know|dont\s*know|unknown|not\s*sure|no\s*idea|idk)[\s.!?]*$/i;
const RECOMMEND_PATTERNS =
  /^(recommend(\s+the\s+best(\s+option)?)?|you\s+decide|best\s+option|surprise\s+me)[\s.!?]*$/i;

/**
 * Parse a chat reply against the current question's numbered options.
 * Supports `1`, `2`, `1,3`, option ids, free-form, unknown, and recommend.
 */
export function parseInterviewAnswer(
  raw: string,
  options: Array<{ id: string; label: string }> = [],
): ParsedInterviewAnswer {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      kind: "free_form",
      selectedOptionIds: [],
      freeText: "",
      selectedNumbers: [],
    };
  }

  if (UNKNOWN_PATTERNS.test(trimmed)) {
    return {
      kind: "unknown",
      selectedOptionIds: options.some((option) => option.id === "unknown")
        ? ["unknown"]
        : [],
      freeText: trimmed,
      selectedNumbers: [],
    };
  }

  if (RECOMMEND_PATTERNS.test(trimmed)) {
    return {
      kind: "recommend",
      selectedOptionIds: options.some((option) => option.id === "recommend")
        ? ["recommend"]
        : [],
      freeText: trimmed,
      selectedNumbers: [],
    };
  }

  // Numbered choices: "1", "1,3", "1 3", "1 and 3"
  const numberOnly = trimmed.replace(/\s+and\s+/gi, ",").replace(/\s+/g, "");
  if (/^\d+(,\d+)*$/.test(numberOnly) && options.length > 0) {
    const numbers = numberOnly.split(",").map((part) => Number(part));
    const selectedOptionIds: string[] = [];
    const selectedNumbers: number[] = [];
    for (const number of numbers) {
      if (!Number.isInteger(number) || number < 1 || number > options.length) {
        continue;
      }
      selectedNumbers.push(number);
      const option = options[number - 1];
      if (option && !selectedOptionIds.includes(option.id)) {
        selectedOptionIds.push(option.id);
      }
    }
    if (selectedOptionIds.length > 0) {
      return {
        kind: selectedOptionIds.length > 1 ? "multi_option" : "option_ids",
        selectedOptionIds,
        freeText: null,
        selectedNumbers,
      };
    }
  }

  // Exact option id match (comma-separated)
  const asIds = trimmed.split(/[,\s]+/).filter(Boolean);
  const matchedIds = asIds.filter((id) =>
    options.some((option) => option.id === id),
  );
  if (matchedIds.length > 0 && matchedIds.length === asIds.length) {
    return {
      kind: matchedIds.length > 1 ? "multi_option" : "option_ids",
      selectedOptionIds: matchedIds,
      freeText: null,
      selectedNumbers: [],
    };
  }

  return {
    kind: "free_form",
    selectedOptionIds: [],
    freeText: trimmed,
    selectedNumbers: [],
  };
}

function classifyUnknown(
  kind: ParsedInterviewAnswerKind,
  category: MarketingInterviewCategory,
): MarketingUnknownClassification {
  if (kind === "recommend") return "decision_pending";
  if (
    category === "budget" ||
    category === "timeline" ||
    category === "constraints"
  ) {
    return "decision_pending";
  }
  if (
    category === "current_situation" ||
    category === "target_customers" ||
    category === "product"
  ) {
    return "research_required";
  }
  return "optional_unknown";
}

function mapObjectiveIds(ids: string[]): MarketingObjectiveKind[] {
  const allowed = new Set<string>(marketingObjectiveKinds);
  return ids.filter((id): id is MarketingObjectiveKind => allowed.has(id));
}

/**
 * Apply a parsed answer to requirement state. Does not invent facts for
 * unknown/recommend — classifies gaps instead.
 */
export function applyInterviewAnswer(
  state: MarketingRequirementState,
  question: MarketingNextQuestion,
  parsed: ParsedInterviewAnswer,
  nowIso: string = new Date().toISOString(),
): MarketingRequirementState {
  const historyEntry = {
    id: question.id,
    category: question.category,
    prompt: question.prompt,
    askedAt: nowIso,
    answerRaw: parsed.freeText ?? parsed.selectedOptionIds.join(","),
    selectedOptionIds: parsed.selectedOptionIds,
    parsedKind: parsed.kind,
  };

  const next: MarketingRequirementState = {
    ...state,
    questionHistory: [...state.questionHistory, historyEntry],
    updatedAt: nowIso,
  };

  if (parsed.kind === "unknown" || parsed.kind === "recommend") {
    const classification = classifyUnknown(parsed.kind, question.category);
    const item = {
      category: question.category,
      classification,
      note: parsed.freeText ?? undefined,
    };
    if (classification === "research_required") {
      next.researchRequired = [...next.researchRequired, item];
    } else if (classification === "decision_pending") {
      next.decisionPending = [...next.decisionPending, item];
    } else {
      next.optionalUnknown = [...next.optionalUnknown, item];
    }
  } else {
    const answered = new Set(next.answeredCategories);
    answered.add(question.category);
    next.answeredCategories = [...answered];

    if (question.category === "objectives") {
      const kinds = mapObjectiveIds(parsed.selectedOptionIds);
      if (kinds.length > 0) {
        next.objectiveKinds = kinds;
        next.objectives = kinds.map((kind) => ({ kind }));
      } else if (parsed.freeText) {
        next.objectiveKinds = ["other"];
        next.objectives = [{ kind: "other", text: parsed.freeText }];
      }
    } else if (question.category === "product" && parsed.freeText) {
      next.product = { ...next.product, description: parsed.freeText };
    } else if (question.category === "business_context") {
      next.businessContext = {
        ...next.businessContext,
        selection: parsed.selectedOptionIds[0] ?? null,
        text: parsed.freeText,
      };
    } else if (question.category === "target_customers" && parsed.freeText) {
      next.targetCustomers = [{ description: parsed.freeText }];
    } else if (question.category === "current_situation") {
      next.currentSituation = {
        selection: parsed.selectedOptionIds[0] ?? null,
        text: parsed.freeText,
      };
    } else if (question.category === "budget") {
      next.budget = {
        selection: parsed.selectedOptionIds[0] ?? null,
        text: parsed.freeText,
      };
    } else if (question.category === "timeline") {
      next.timeline = {
        selection: parsed.selectedOptionIds[0] ?? null,
        text: parsed.freeText,
      };
    } else if (question.category === "success_criteria" && parsed.freeText) {
      next.successCriteria = [{ description: parsed.freeText }];
    } else if (question.category === "constraints" && parsed.freeText) {
      next.constraints = [{ description: parsed.freeText }];
    } else if (question.category === "automation_permissions") {
      next.automationPermissions = {
        selectedOptionIds: parsed.selectedOptionIds,
        text: parsed.freeText,
      };
    }
  }

  const nextQuestion = selectNextInterviewQuestion(next);
  next.nextQuestion = nextQuestion;
  if (isRequirementBriefReady(next)) {
    next.status = "pending_confirmation";
  } else {
    next.status = "interviewing";
  }

  next.version = state.version + 1;
  return marketingRequirementStateSchema.parse(next);
}

function formatUnknownList(
  title: string,
  items: Array<{ category: string; classification: string; note?: string }>,
): string {
  if (items.length === 0) {
    return `## ${title}\n\n- _(none)_\n`;
  }
  const lines = items.map(
    (item) =>
      `- **${item.category}** (${item.classification})${item.note ? `: ${item.note}` : ""}`,
  );
  return `## ${title}\n\n${lines.join("\n")}\n`;
}

/** Generate markdown requirement brief from structured state. Never invents answers. */
export function generateRequirementBriefMarkdown(
  state: MarketingRequirementState,
): string {
  const objectives =
    state.objectiveKinds.length > 0
      ? state.objectiveKinds.map((kind) => `- ${kind}`).join("\n")
      : "- _(not yet specified)_";

  const product =
    typeof state.product.description === "string"
      ? state.product.description
      : JSON.stringify(state.product) === "{}"
        ? "_(not yet specified)_"
        : JSON.stringify(state.product, null, 2);

  const customers =
    state.targetCustomers.length > 0
      ? state.targetCustomers
          .map((row) =>
            typeof row === "object" &&
            row &&
            "description" in row &&
            typeof (row as { description: unknown }).description === "string"
              ? `- ${(row as { description: string }).description}`
              : `- ${JSON.stringify(row)}`,
          )
          .join("\n")
      : "- _(not yet specified)_";

  const success =
    state.successCriteria.length > 0
      ? state.successCriteria.map((row) => `- ${JSON.stringify(row)}`).join("\n")
      : "- _(not yet specified)_";

  const constraints =
    state.constraints.length > 0
      ? state.constraints.map((row) => `- ${JSON.stringify(row)}`).join("\n")
      : "- _(none recorded)_";

  const assumptions =
    state.assumptions.length > 0
      ? state.assumptions.map((row) => `- ${JSON.stringify(row)}`).join("\n")
      : "- _(none)_";

  return `# Marketing Requirement Brief

## Business goal

${objectives}

## Product information

${product}

## Business context

\`\`\`json
${JSON.stringify(state.businessContext, null, 2)}
\`\`\`

## Target market / ICP

${customers}

## Current situation

\`\`\`json
${JSON.stringify(state.currentSituation, null, 2)}
\`\`\`

## Budget

\`\`\`json
${JSON.stringify(state.budget, null, 2)}
\`\`\`

## Timeline

\`\`\`json
${JSON.stringify(state.timeline, null, 2)}
\`\`\`

## Success criteria

${success}

## Constraints

${constraints}

## Assumptions

${assumptions}

${formatUnknownList("Research gaps", state.researchRequired)}
${formatUnknownList("Decisions pending", state.decisionPending)}
${formatUnknownList("Optional unknowns", state.optionalUnknown)}
## Automation permissions

\`\`\`json
${JSON.stringify(state.automationPermissions, null, 2)}
\`\`\`

---

**Status:** ${state.status}  
**Approval:** ${state.approvalStatus}  
**Workflow:** ${state.workflowId} (v${state.version})
`;
}

/**
 * Whether a child issue marker requires an approved requirement brief on the parent.
 */
export function requiresApprovedRequirementBrief(
  marker: MarketingWorkforceMarker | null | undefined,
): boolean {
  if (!marker) return false;
  if (marker.phase === "planning" || marker.phase === "execution") return true;
  return (MARKETING_PLANNING_WORKFLOW_IDS as readonly string[]).includes(
    marker.workflowId,
  );
}

export function readMarketingWorkforceMarker(
  executionPolicy: unknown,
): MarketingWorkforceMarker | null {
  if (!executionPolicy || typeof executionPolicy !== "object") return null;
  const raw = (executionPolicy as { marketingWorkforce?: unknown })
    .marketingWorkforce;
  const parsed = marketingWorkforceMarkerSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
