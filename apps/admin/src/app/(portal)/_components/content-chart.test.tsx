import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentActivityChart } from "./content-chart";

const today = new Date().toISOString();

function legendOrder(markup: string, labels: string[]): number[] {
  return labels.map((label) => markup.indexOf(`</span>${label}</span>`));
}

test("the activity chart has its title, period, three-colour legend and a 180px plot", () => {
  const markup = renderToStaticMarkup(
    <ContentActivityChart
      activity={[{ $createdAt: today, resource_type: "event" }]}
    />
  );
  expect(markup).toContain(">Activity</h2>");
  expect(markup).toContain(">Last 14 days</p>");
  const positions = legendOrder(markup, ["Events", "News", "Jobs"]);
  expect(positions.every((position) => position > 0)).toBe(true);
  expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  expect(markup).toContain('style="background:#6b1e1e"></span>Events');
  expect(markup).toContain('style="background:#2a4a7a"></span>News');
  expect(markup).toContain('style="background:#2f5d3a"></span>Jobs');
  expect(markup).toContain("height:180px");
  expect(markup).not.toContain("No activity recorded yet");
});

test("the activity chart says so when nothing was recorded", () => {
  const markup = renderToStaticMarkup(
    <ContentActivityChart activity={[]} days={7} />
  );
  expect(markup).toContain(">Last 7 days</p>");
  expect(markup).toContain(
    '<div class="flex h-40 items-center justify-center"><p class="text-sm" style="color:#9c9385">No activity recorded yet</p></div>'
  );
  expect(markup).not.toContain("recharts-responsive-container");
});
