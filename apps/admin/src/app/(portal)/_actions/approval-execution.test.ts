import { describe, expect, test } from "bun:test";
import { buildApprovalPublishPlan } from "./approval-execution";

describe("approval publish execution planning", () => {
  test("maps supported publish actions to the target table", () => {
    const plan = buildApprovalPublishPlan({
      action: "jobs.publish",
      payload: "{}",
      resource_id: "job-1",
    });

    expect(plan).toMatchObject({
      domain: "jobs",
      resourceId: "job-1",
      table: "jobs",
    });
    expect(plan.paths).toContain("/jobs");
  });

  test("accepts the resource id from the approval payload", () => {
    const plan = buildApprovalPublishPlan({
      action: "shop.publish",
      payload: JSON.stringify({ id: "product-1" }),
      resource_id: null,
    });

    expect(plan.resourceId).toBe("product-1");
    expect(plan.table).toBe("webshop_products");
  });

  test("rejects unsupported actions before approval state changes", () => {
    expect(() =>
      buildApprovalPublishPlan({
        action: "jobs.update",
        payload: "{}",
        resource_id: "job-1",
      })
    ).toThrow("Unsupported approval action");
  });

  test("rejects malformed approval payloads", () => {
    expect(() =>
      buildApprovalPublishPlan({
        action: "jobs.publish",
        payload: "not-json",
        resource_id: null,
      })
    ).toThrow("not valid JSON");
  });
});
