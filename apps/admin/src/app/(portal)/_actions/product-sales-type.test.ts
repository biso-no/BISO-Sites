import { describe, expect, test } from "bun:test";
import { productSchema } from "./schemas";

const base = {
  campus_id: "1",
  name: "Sivøk genser (M)",
  regular_price: 299,
  slug: "sivok-genser-m",
  status: "draft" as const,
};

function fieldIssue(field: string, values: Record<string, unknown>) {
  const parsed = productSchema.safeParse(values);
  return parsed.success
    ? undefined
    : parsed.error.issues.find((issue) => issue.path[0] === field);
}

function salesTypeIssue(values: Record<string, unknown>) {
  return fieldIssue("sales_type", values);
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

  test("publishing requires a department", () => {
    expect(
      fieldIssue("department_id", {
        ...base,
        sales_type: "varesalg",
        status: "published",
      })?.message
    ).toBe("Choose a department before publishing");
  });

  test("sending for approval requires a department", () => {
    expect(
      fieldIssue("department_id", {
        ...base,
        department_id: "",
        sales_type: "varesalg",
        status: "pending_approval",
      })
    ).toBeDefined();
  });

  test("a draft can be saved without a department", () => {
    expect(
      fieldIssue("department_id", { ...base, sales_type: "varesalg" })
    ).toBeUndefined();
  });

  test("a product with a sales type and a department can be published", () => {
    expect(
      productSchema.safeParse({
        ...base,
        department_id: "1",
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
