import { beforeEach, describe, expect, it } from "vitest";
import { useExpenseStore } from "./store";

describe("description ownership", () => {
  beforeEach(() => useExpenseStore.getState().reset());

  it("treats AI text as the AI's and anything else as the student's", () => {
    const store = useExpenseStore.getState();
    store.setAiDescription("Dinner for the board");
    expect(useExpenseStore.getState().descriptionEditedByStudent).toBe(false);

    useExpenseStore.getState().setDescription("Dinner for the board, mine");
    expect(useExpenseStore.getState().descriptionEditedByStudent).toBe(true);

    useExpenseStore.getState().setAiDescription("New text");
    expect(useExpenseStore.getState().descriptionEditedByStudent).toBe(false);
    expect(useExpenseStore.getState().lastAiDescription).toBe("New text");
  });

  it("counts a reopened draft's description as the student's", () => {
    useExpenseStore.getState().setDescription("Saved earlier");
    expect(useExpenseStore.getState().descriptionEditedByStudent).toBe(true);
  });
});

describe("occasion ownership", () => {
  beforeEach(() => useExpenseStore.getState().reset());

  it("marks the AI's occasion until the student changes it", () => {
    useExpenseStore.getState().setAiOccasion("Board dinner");
    expect(useExpenseStore.getState()).toMatchObject({
      occasion: "Board dinner",
      occasionFromAi: true,
    });

    useExpenseStore.getState().setOccasion("Board dinner, six members");
    expect(useExpenseStore.getState()).toMatchObject({
      occasion: "Board dinner, six members",
      occasionFromAi: false,
    });
  });
});

describe("approval switches", () => {
  beforeEach(() => useExpenseStore.getState().reset());

  it("clears both switches when the department changes", () => {
    const assign = (campusId: string, departmentId: string) =>
      useExpenseStore.getState().setAssignment({
        campusId,
        campusName: "",
        departmentId,
        departmentName: "",
      });
    assign("1", "10");
    useExpenseStore.getState().setSubmitterIsFinancialManager(true);
    useExpenseStore.getState().setSubmitterIsController(true);

    assign("1", "10");
    expect(useExpenseStore.getState()).toMatchObject({
      submitterIsController: true,
      submitterIsFinancialManager: true,
    });

    assign("1", "2");
    expect(useExpenseStore.getState()).toMatchObject({
      submitterIsController: false,
      submitterIsFinancialManager: false,
    });
  });
});
