import { describe, expect, test } from "bun:test";
import { productSchema } from "./schemas";

const base = {
  campus_id: "1",
  name: "Sivøk genser (M)",
  regular_price: 299,
  slug: "sivok-genser-m",
  status: "draft" as const,
};

function salesTypeIssue(values: Record<string, unknown>) {
  const parsed = productSchema.safeParse(values);
  return parsed.success
    ? undefined
    : parsed.error.issues.find((issue) => issue.path[0] === "sales_type");
}

describe("product sales type", () => {
  test("a draft can be saved without a sales type", () => {
    expect(productSchema.safeParse(base).success).toBe(true);
  });

  test("publishing requires a sales type", () => {
    expect(salesTypeIssue({ ...base, status: "published" })?.message).toBe(
      "Choose a sales type before publishing"
    );
  });

  test("sending for approval requires a sales type", () => {
    expect(
      salesTypeIssue({ ...base, status: "pending_approval" })
    ).toBeDefined();
  });

  test("a product with a sales type can be published", () => {
    expect(
      productSchema.safeParse({
        ...base,
        sales_type: "varesalg",
        status: "published",
      }).success
    ).toBe(true);
  });

  test("a name is still required", () => {
    const parsed = productSchema.safeParse({ ...base, name: "" });
    expect(parsed.success).toBe(false);
  });
});
