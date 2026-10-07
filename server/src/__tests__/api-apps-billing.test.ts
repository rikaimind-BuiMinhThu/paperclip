import { describe, expect, it } from "vitest";
import { billablePacksForQuantity } from "../services/billing-units.js";
import {
  createCustomerApiToken,
  hashCustomerToken,
  planCostCents,
} from "../services/api-apps.js";

describe("api apps billing helpers", () => {
  it("creates pcp_cust_ tokens and hashes stably", () => {
    const token = createCustomerApiToken();
    expect(token.startsWith("pcp_cust_")).toBe(true);
    expect(hashCustomerToken(token)).toHaveLength(64);
    expect(hashCustomerToken(token)).toBe(hashCustomerToken(token));
    expect(hashCustomerToken(token)).not.toBe(hashCustomerToken(`${token}x`));
  });

  it("computes billable packs with ceil division", () => {
    expect(billablePacksForQuantity(1, 1)).toBe(1);
    expect(billablePacksForQuantity(12, 1)).toBe(12);
    expect(billablePacksForQuantity(1, 100)).toBe(1);
    expect(billablePacksForQuantity(100, 100)).toBe(1);
    expect(billablePacksForQuantity(101, 100)).toBe(2);
    expect(billablePacksForQuantity(350, 100)).toBe(4);
  });

  it("applies plan cost multiplier in basis points", () => {
    expect(planCostCents(100, 10000)).toBe(100);
    expect(planCostCents(100, 15000)).toBe(150);
    expect(planCostCents(1, 15000)).toBe(2);
  });
});
