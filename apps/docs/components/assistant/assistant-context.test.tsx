import { afterEach, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AssistantProvider, useAssistant } from "./assistant-context";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function Probe() {
  const { enabled, ask } = useAssistant();
  return <span>{`${enabled ? "on" : "off"} ${typeof ask}`}</span>;
}

test("without a provider the assistant is off", () => {
  expect(renderToStaticMarkup(<Probe />)).toBe("<span>off function</span>");
});

test("server rendering stays off and never calls the api", () => {
  let calls = 0;
  globalThis.fetch = (() => {
    calls += 1;
    return Promise.resolve(Response.json({ enabled: true }));
  }) as unknown as typeof fetch;
  const html = renderToStaticMarkup(
    <AssistantProvider>
      <Probe />
    </AssistantProvider>
  );
  expect(html).toContain("<span>off function</span>");
  expect(calls).toBe(0);
});
