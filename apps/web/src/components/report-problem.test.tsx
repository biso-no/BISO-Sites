import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { codeOnly } from "@/test/source";

const mocks = vi.hoisted(() => ({ openFeedbackForm: vi.fn() }));

vi.mock("@repo/observability/browser/feedback", () => ({
  openFeedbackForm: mocks.openFeedbackForm,
}));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

import { useReportProblem } from "./report-problem";

const read = (f: string) =>
  codeOnly(readFileSync(join(import.meta.dirname, f), "utf8"));

beforeEach(() => {
  mocks.openFeedbackForm.mockClear();
});

describe("useReportProblem", () => {
  it("opens the web form with every label from the reportProblem messages", () => {
    let report: ReturnType<typeof useReportProblem> | undefined;
    const Probe = () => {
      report = useReportProblem();
      return null;
    };
    renderToString(<Probe />);
    expect(report?.label).toBe("reportProblem.link");
    report?.open();
    expect(mocks.openFeedbackForm).toHaveBeenCalledTimes(1);
    const [app, labels] = mocks.openFeedbackForm.mock.calls[0] ?? [];
    expect(app).toBe("web");
    expect(Object.keys(labels).sort()).toEqual([
      "addScreenshotButtonLabel",
      "cancelButtonLabel",
      "errorGenericText",
      "formTitle",
      "isRequiredLabel",
      "messageLabel",
      "messagePlaceholder",
      "removeScreenshotButtonLabel",
      "submitButtonLabel",
      "successMessageText",
    ]);
    expect(labels.formTitle).toBe("reportProblem.formTitle");
  });
});

describe("report a problem entry points", () => {
  it("the footer island opens the form on click", () => {
    const island = read("layout/footer-report-problem.tsx");
    expect(island).toContain('"use client"');
    expect(island).toContain("onClick={open}");
    expect(read("layout/footer-v2.tsx")).toContain("<FooterReportProblem />");
  });

  it("the account menu has an item that opens the form", () => {
    const menu = read("nav/account-menu.tsx");
    expect(menu).toContain("useReportProblem");
    expect(menu).toContain("onSelect={report.open}");
  });

  it("the mobile drawer has an action that opens the form", () => {
    const drawer = read("nav/mobile-drawer.tsx");
    expect(drawer).toContain("useReportProblem");
    expect(drawer).toContain("report.open()");
  });
});
