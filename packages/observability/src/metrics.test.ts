import { metrics } from "@sentry/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { countMetric, gaugeMetric } from "./metrics";

const noop = (): void => undefined;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("countMetric", () => {
  it("does not throw without a Sentry client", () => {
    expect(() => countMetric("push.sent")).not.toThrow();
  });

  it("drops attribute keys outside the allow-list", () => {
    const count = vi.spyOn(metrics, "count").mockImplementation(noop);
    countMetric("push.sent", { email: "a@b.no" } as never);
    expect(count).toHaveBeenCalledWith("push.sent", 1, { attributes: {} });
  });

  it("keeps allowed attributes", () => {
    const count = vi.spyOn(metrics, "count").mockImplementation(noop);
    countMetric("payment.completed", {
      provider: "vipps",
      extra: "x",
    } as never);
    expect(count).toHaveBeenCalledWith("payment.completed", 1, {
      attributes: { provider: "vipps" },
    });
  });

  it("swallows an error from the SDK", () => {
    vi.spyOn(metrics, "count").mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => countMetric("push.failed")).not.toThrow();
  });
});

describe("gaugeMetric", () => {
  it("does not throw without a Sentry client", () => {
    expect(() => gaugeMetric("orders.stuck", 3)).not.toThrow();
  });

  it("skips a NaN value", () => {
    const gauge = vi.spyOn(metrics, "gauge").mockImplementation(noop);
    expect(() => gaugeMetric("orders.stuck", Number.NaN)).not.toThrow();
    expect(gauge).not.toHaveBeenCalled();
  });

  it("records a value", () => {
    const gauge = vi.spyOn(metrics, "gauge").mockImplementation(noop);
    gaugeMetric("orders.stuck", 2);
    expect(gauge).toHaveBeenCalledWith("orders.stuck", 2, { attributes: {} });
  });

  it("swallows an error from the SDK", () => {
    vi.spyOn(metrics, "gauge").mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => gaugeMetric("orders.stuck", 1)).not.toThrow();
  });
});
