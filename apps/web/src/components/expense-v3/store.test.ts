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

describe("assignment and the accepted event", () => {
  const assign = (departmentId: string) =>
    useExpenseStore.getState().setAssignment({
      campusId: "5",
      campusName: "Oslo",
      departmentId,
      departmentName: departmentId,
    });

  beforeEach(() => useExpenseStore.getState().reset());

  it("changing the department clears the accepted event", () => {
    assign("dept-1");
    useExpenseStore.getState().setEvent("ev-1", "Fadderuka");
    assign("dept-2");
    expect(useExpenseStore.getState().eventId).toBeNull();
    expect(useExpenseStore.getState().eventName).toBe("");
  });

  it("keeps the event when the same department is picked again", () => {
    assign("dept-1");
    useExpenseStore.getState().setEvent("ev-1", "Fadderuka");
    assign("dept-1");
    expect(useExpenseStore.getState().eventId).toBe("ev-1");
    expect(useExpenseStore.getState().eventName).toBe("Fadderuka");
  });
});

describe("submit readiness", () => {
  beforeEach(() => useExpenseStore.getState().reset());

  const ready = () => {
    const store = useExpenseStore.getState();
    store.setAssignment({
      campusId: "5",
      campusName: "National",
      departmentId: "1002",
      departmentName: "Operations Unit",
    });
    store.setProfile({ bank_account: "12345678903", name: "Kari" } as never);
    store.setDescription("Taxi to the board meeting");
  };
  const unreadReceipt = {
    amount: 0,
    confidence: 0,
    currency: "NOK",
    date: "",
    description: "",
    fileId: "f1",
    fileName: "taxi.jpg",
    fileType: "image/jpeg",
    fileUrl: "",
    id: "r1",
    progress: 100,
    scanFailed: true,
    status: "ready" as const,
    typeState: "needs_choice" as const,
  };

  it("holds a receipt that could not be read until it has an amount", () => {
    ready();
    useExpenseStore.getState().addReceipt(unreadReceipt);
    expect(useExpenseStore.getState().isReadyToSubmit()).toBe(false);

    useExpenseStore
      .getState()
      .updateReceipt("r1", { amount: 120, costType: "travel" });
    expect(useExpenseStore.getState().isReadyToSubmit()).toBe(true);
  });
});
