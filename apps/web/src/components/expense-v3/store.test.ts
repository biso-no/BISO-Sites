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
