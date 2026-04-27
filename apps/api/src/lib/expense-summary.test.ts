import { describe, expect, it } from "vitest";
import {
  buildExpenseSummaryPrompt,
  normalizeExpenseSummaryRequest,
} from "./expense-summary";

describe("expense summary helpers", () => {
  it("normalizes the structured summary payload with assignment context", () => {
    const normalized = normalizeExpenseSummaryRequest({
      assignment: {
        campusId: "campus-oslo",
        campusName: "Oslo",
        departmentId: "dept-marketing",
        departmentName: "Marketing",
      },
      receipts: [
        {
          amount: 248,
          category: "meal",
          city: "Stockholm",
          country: "Sweden",
          currency: "SEK",
          date: "2026-04-20",
          description: "Lunch receipt, Stockholm",
          documentType: "receipt",
          vendor: "Kungsan Grill",
        },
      ],
    });

    expect(normalized).toEqual({
      assignment: {
        campusId: "campus-oslo",
        campusName: "Oslo",
        departmentId: "dept-marketing",
        departmentName: "Marketing",
      },
      receipts: [
        {
          amount: 248,
          category: "meal",
          city: "Stockholm",
          country: "Sweden",
          currency: "SEK",
          date: "2026-04-20",
          description: "Lunch receipt, Stockholm",
          documentType: "receipt",
          vendor: "Kungsan Grill",
        },
      ],
    });
  });

  it("keeps legacy description payloads working during migration", () => {
    const normalized = normalizeExpenseSummaryRequest({
      descriptions: ["Office supplies", "Lunch receipt"],
    });

    expect(normalized).toEqual({
      assignment: {
        campusId: "",
        campusName: "",
        departmentId: "",
        departmentName: "",
      },
      receipts: [
        { description: "Office supplies" },
        { description: "Lunch receipt" },
      ],
    });
  });

  it("builds an accounting prompt that prioritizes purpose over vendor names", () => {
    const prompt = buildExpenseSummaryPrompt({
      assignment: {
        campusId: "campus-oslo",
        campusName: "Oslo",
        departmentId: "dept-marketing",
        departmentName: "Marketing",
      },
      receipts: [
        {
          amount: 248,
          category: "meal",
          city: "Stockholm",
          country: "Sweden",
          currency: "SEK",
          date: "2026-04-20",
          description: "Lunch receipt, Stockholm",
          documentType: "receipt",
          vendor: "Kungsan Grill",
        },
      ],
    });

    expect(prompt).toContain("Campus: Oslo");
    expect(prompt).toContain("Department: Marketing");
    expect(prompt).toContain("city=Stockholm");
    expect(prompt).toContain("vendor=Kungsan Grill");
    expect(prompt).toContain("Lunch during Stockholm trip");
    expect(prompt).toContain("Bad examples");
    expect(prompt).toContain("Meal expense at Kungsan Grill");
  });

  it("instructs the model to avoid inventing context when location is missing", () => {
    const prompt = buildExpenseSummaryPrompt({
      assignment: {
        campusId: "campus-bergen",
        campusName: "Bergen",
        departmentId: "dept-finance",
        departmentName: "Finance",
      },
      receipts: [
        {
          amount: 100,
          category: "meal",
          description: "Meal receipt",
          vendor: "Unknown cafe",
        },
      ],
    });

    expect(prompt).toContain("Do not invent specific event names");
    expect(prompt).toContain("when the location is explicit");
    expect(prompt).not.toContain("city=");
  });

  it("includes mixed-purpose guidance for unrelated receipts", () => {
    const prompt = buildExpenseSummaryPrompt({
      assignment: {
        campusId: "campus-oslo",
        campusName: "Oslo",
        departmentId: "dept-operations",
        departmentName: "Operations",
      },
      receipts: [
        {
          category: "supplies",
          description: "Office supplies",
        },
        {
          category: "travel",
          description: "Train ticket",
          city: "Bergen",
        },
      ],
    });

    expect(prompt).toContain("mixed expenses");
    expect(prompt).toContain("category=supplies");
    expect(prompt).toContain("category=travel");
  });
});
