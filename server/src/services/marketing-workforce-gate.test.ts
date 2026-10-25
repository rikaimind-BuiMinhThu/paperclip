import { describe, expect, it } from "vitest";
import {
  extractConfirmationTargetKey,
  interactionConfirmsRequirementBrief,
} from "./marketing-workforce-gate.js";

describe("marketing-workforce-gate helpers", () => {
  it("extracts confirmation target key", () => {
    expect(
      extractConfirmationTargetKey({
        target: { type: "issue_document", key: "requirement_brief" },
      }),
    ).toBe("requirement_brief");
    expect(extractConfirmationTargetKey({})).toBeNull();
  });

  it("accepts only accepted brief confirmations", () => {
    expect(
      interactionConfirmsRequirementBrief({
        kind: "request_checkbox_confirmation",
        status: "accepted",
        payload: {
          target: { type: "issue_document", key: "requirement_brief" },
        },
      }),
    ).toBe(true);

    expect(
      interactionConfirmsRequirementBrief({
        kind: "request_checkbox_confirmation",
        status: "pending",
        payload: {
          target: { type: "issue_document", key: "requirement_brief" },
        },
      }),
    ).toBe(false);

    expect(
      interactionConfirmsRequirementBrief({
        kind: "request_confirmation",
        status: "accepted",
        payload: {
          target: { type: "issue_document", key: "plan" },
        },
      }),
    ).toBe(false);
  });
});
