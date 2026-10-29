import { describe, expect, it } from "vitest";
import { displayedInferenceCents, formatCents, visibleRunCostUsd } from "./utils";

describe("displayed inference cost", () => {
  it("shows a reported $1.00 run as $2.00", () => {
    expect(visibleRunCostUsd({ costUsd: 1 })).toBe(2);
    expect(formatCents(displayedInferenceCents(100))).toBe("$2.00");
  });

  it("keeps subscription-included runs at $0.00", () => {
    expect(
      visibleRunCostUsd({ costUsd: 1, billingType: "subscription_included" }),
    ).toBe(0);
    expect(formatCents(displayedInferenceCents(0))).toBe("$0.00");
  });

  it("leaves a budget cap on the raw cents", () => {
    expect(formatCents(5000)).toBe("$50.00");
  });
});
