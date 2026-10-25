import { describe, expect, it } from "vitest";
import {
  applyInterviewAnswer,
  createEmptyMarketingRequirementState,
  generateRequirementBriefMarkdown,
  isRequirementBriefReady,
  missingCriticalCategories,
  parseInterviewAnswer,
  readMarketingWorkforceMarker,
  requiresApprovedRequirementBrief,
  selectNextInterviewQuestion,
} from "./marketing-requirement.js";

const OBJECTIVE_OPTIONS = [
  { id: "brand_awareness", label: "Build brand awareness." },
  { id: "qualified_leads", label: "Generate qualified leads." },
  { id: "product_sales", label: "Increase product sales." },
  { id: "validate_demand", label: "Validate market demand." },
  { id: "multiple", label: "Combine multiple objectives." },
  { id: "other", label: "Other." },
  { id: "unknown", label: "I don't know." },
  { id: "recommend", label: "Recommend the best option." },
];

describe("parseInterviewAnswer", () => {
  it("parses a single numbered choice", () => {
    expect(parseInterviewAnswer("1", OBJECTIVE_OPTIONS)).toMatchObject({
      kind: "option_ids",
      selectedOptionIds: ["brand_awareness"],
      selectedNumbers: [1],
    });
  });

  it("parses multiple numbered choices", () => {
    expect(parseInterviewAnswer("1,3", OBJECTIVE_OPTIONS)).toMatchObject({
      kind: "multi_option",
      selectedOptionIds: ["brand_awareness", "product_sales"],
      selectedNumbers: [1, 3],
    });
  });

  it("parses free-form text", () => {
    expect(parseInterviewAnswer("Launch in Japan for SMBs", OBJECTIVE_OPTIONS)).toMatchObject({
      kind: "free_form",
      freeText: "Launch in Japan for SMBs",
      selectedOptionIds: [],
    });
  });

  it("parses unknown answers", () => {
    expect(parseInterviewAnswer("I don't know", OBJECTIVE_OPTIONS)).toMatchObject({
      kind: "unknown",
      selectedOptionIds: ["unknown"],
    });
  });

  it("parses recommend answers", () => {
    expect(parseInterviewAnswer("Recommend the best option", OBJECTIVE_OPTIONS)).toMatchObject({
      kind: "recommend",
      selectedOptionIds: ["recommend"],
    });
  });
});

describe("adaptive interview selection", () => {
  it("starts with the objectives question", () => {
    const state = createEmptyMarketingRequirementState();
    const next = selectNextInterviewQuestion(state);
    expect(next?.id).toBe("q_objectives_primary");
  });

  it("avoids repeating an answered category", () => {
    let state = createEmptyMarketingRequirementState();
    const first = selectNextInterviewQuestion(state);
    expect(first).not.toBeNull();
    state = applyInterviewAnswer(
      state,
      first!,
      parseInterviewAnswer("2", first!.options ?? []),
      "2026-10-25T00:00:00.000Z",
    );
    expect(state.objectiveKinds).toEqual(["qualified_leads"]);
    expect(state.answeredCategories).toContain("objectives");

    const second = selectNextInterviewQuestion(state);
    expect(second?.id).not.toBe("q_objectives_primary");
    expect(second?.category).not.toBe("objectives");
  });

  it("prioritizes product after lead-gen objective", () => {
    let state = createEmptyMarketingRequirementState();
    const first = selectNextInterviewQuestion(state)!;
    state = applyInterviewAnswer(
      state,
      first,
      parseInterviewAnswer("2", first.options ?? []),
      "2026-10-25T00:00:00.000Z",
    );
    expect(selectNextInterviewQuestion(state)?.category).toBe("product");
  });

  it("marks brief ready after critical categories are satisfied", () => {
    let state = createEmptyMarketingRequirementState();
    const criticalAnswers: Array<{ category: string; answer: string }> = [
      { category: "objectives", answer: "2" },
      { category: "product", answer: "Kujira AI Workforce" },
      { category: "business_context", answer: "1" },
      { category: "target_customers", answer: "Japanese SMB operators" },
      { category: "success_criteria", answer: "50 qualified demos / month" },
    ];

    for (const _step of criticalAnswers) {
      const question = selectNextInterviewQuestion(state);
      expect(question).not.toBeNull();
      const options = question!.options ?? [];
      const parsed = parseInterviewAnswer(
        criticalAnswers.find((row) => row.category === question!.category)?.answer ??
          "done",
        options,
      );
      state = applyInterviewAnswer(state, question!, parsed, "2026-10-25T00:00:00.000Z");
    }

    expect(missingCriticalCategories(state)).toEqual([]);
    expect(isRequirementBriefReady(state)).toBe(true);
    expect(selectNextInterviewQuestion(state)).toBeNull();
    expect(state.status).toBe("pending_confirmation");
  });
});

describe("unknown answers", () => {
  it("classifies unknown without inventing facts", () => {
    let state = createEmptyMarketingRequirementState();
    const question = selectNextInterviewQuestion(state)!;
    state = applyInterviewAnswer(
      state,
      question,
      parseInterviewAnswer("I don't know", question.options ?? []),
      "2026-10-25T00:00:00.000Z",
    );
    expect(state.answeredCategories).not.toContain("objectives");
    expect(
      [...state.researchRequired, ...state.decisionPending, ...state.optionalUnknown].some(
        (item) => item.category === "objectives",
      ),
    ).toBe(true);
    expect(state.objectiveKinds).toEqual([]);
  });
});

describe("requirement brief generation", () => {
  it("renders structured markdown without inventing gaps", () => {
    const state = createEmptyMarketingRequirementState({
      objectiveKinds: ["qualified_leads"],
      answeredCategories: ["objectives", "product"],
      product: { description: "Kujira AI" },
      status: "pending_confirmation",
    });
    const md = generateRequirementBriefMarkdown(state);
    expect(md).toContain("# Marketing Requirement Brief");
    expect(md).toContain("qualified_leads");
    expect(md).toContain("Kujira AI");
    expect(md).toContain("Research gaps");
  });
});

describe("planning gate helpers", () => {
  it("requires approval for WF-03 and planning phase", () => {
    expect(
      requiresApprovedRequirementBrief({ workflowId: "WF-03" }),
    ).toBe(true);
    expect(
      requiresApprovedRequirementBrief({
        workflowId: "WF-01",
        phase: "planning",
      }),
    ).toBe(true);
    expect(
      requiresApprovedRequirementBrief({ workflowId: "WF-01" }),
    ).toBe(false);
  });

  it("reads marker from executionPolicy", () => {
    expect(
      readMarketingWorkforceMarker({
        marketingWorkforce: { workflowId: "WF-02" },
      }),
    ).toEqual({ workflowId: "WF-02" });
    expect(readMarketingWorkforceMarker({})).toBeNull();
  });
});
