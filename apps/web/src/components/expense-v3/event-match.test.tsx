// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findNearbyDepartmentEvents = vi.hoisted(() => vi.fn());

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key} ${Object.values(values).join(" ")}` : key,
}));
vi.mock("@/lib/actions/expense-events-match", () => ({
  findNearbyDepartmentEvents,
}));

import { EventMatch, useNearbyEvent } from "./event-match";
import type { Receipt } from "./store";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const receipt = (date: string): Receipt => ({
  amount: 249,
  confidence: 1,
  currency: "NOK",
  date,
  description: "Pizza",
  fileId: "f1",
  fileName: "pizza.jpg",
  fileType: "image/jpeg",
  fileUrl: "",
  id: `r-${date}`,
  progress: 100,
  status: "ready",
});

function Harness({ receipts }: { receipts: Receipt[] }) {
  const [eventName, setEventName] = useState("");
  const nearby = useNearbyEvent("dept-1", receipts);
  return createElement(EventMatch, {
    eventName,
    onAccept: (event) => setEventName(event.title),
    onDismiss: nearby.dismiss,
    onRemove: () => setEventName(""),
    suggestion: nearby.suggestion,
  });
}

async function render(receipts: Receipt[]) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.append(container);
  await act(() => {
    createRoot(container).render(createElement(Harness, { receipts }));
  });
  return container;
}

const buttonByText = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll("button")].find(
    (button) => button.textContent === text
  );

describe("event match", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    findNearbyDepartmentEvents.mockReset();
    findNearbyDepartmentEvents.mockResolvedValue({
      success: true,
      data: [
        { id: "e1", startDate: "2026-11-05T17:00:00.000Z", title: "Julebord" },
        { id: "e2", startDate: "2026-11-07T17:00:00.000Z", title: "Fagdag" },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks about the nearest event once the dates settle", async () => {
    const container = await render([receipt("2026-11-05")]);
    expect(findNearbyDepartmentEvents).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(findNearbyDepartmentEvents).toHaveBeenCalledTimes(1);
    expect(findNearbyDepartmentEvents).toHaveBeenCalledWith({
      departmentId: "dept-1",
      dates: ["2026-11-05"],
    });
    expect(container.textContent).toContain("eventQuestion Julebord");
    expect(container.textContent).not.toContain("Fagdag");
  });

  it("hides the suggestion after No", async () => {
    const container = await render([receipt("2026-11-05")]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    await act(() => {
      buttonByText(container, "eventNo")?.click();
    });

    expect(container.textContent).toBe("");
  });

  it("keeps a Yes as a removable event tag", async () => {
    const container = await render([receipt("2026-11-05")]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    await act(() => {
      buttonByText(container, "eventYes")?.click();
    });

    expect(container.textContent).toContain("Julebord");
    const remove = container.querySelector(
      'button[aria-label="removeEvent Julebord"]'
    ) as HTMLButtonElement | null;
    expect(remove).not.toBeNull();

    await act(() => {
      remove?.click();
    });
    expect(container.textContent).toContain("eventQuestion Julebord");
  });

  it("does not look up events without a receipt date", async () => {
    await render([receipt("")]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(findNearbyDepartmentEvents).not.toHaveBeenCalled();
  });
});
