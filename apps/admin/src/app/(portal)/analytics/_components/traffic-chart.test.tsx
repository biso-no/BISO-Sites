import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TrafficChart, type TrafficPoint } from "./traffic-chart";

const labels = {
  emptyLabel: "No visits yet",
  legend: { pageviews: "Page views", sessions: "Visits" },
  subtitle: "Last 30 days",
  title: "Traffic",
};

test("the traffic chart has its labels, a two-colour legend and a 220px plot", () => {
  const data: TrafficPoint[] = [
    { date: "Nov 1", pageviews: 0, sessions: 0 },
    { date: "Nov 2", pageviews: 3, sessions: 1 },
  ];
  const markup = renderToStaticMarkup(<TrafficChart data={data} {...labels} />);
  expect(markup).toContain(">Traffic</h2>");
  expect(markup).toContain(">Last 30 days</p>");
  expect(markup).toContain('style="background:#6b1e1e"></span>Page views');
  expect(markup).toContain('style="background:#2a4a7a"></span>Visits');
  expect(markup.indexOf("Page views")).toBeLessThan(markup.indexOf("Visits"));
  expect(markup).toContain("height:220px");
  expect(markup).not.toContain("No visits yet");
});

test("the traffic chart shows the empty label when every point is zero", () => {
  const markup = renderToStaticMarkup(
    <TrafficChart
      data={[{ date: "Nov 1", pageviews: 0, sessions: 0 }]}
      {...labels}
    />
  );
  expect(markup).toContain(
    '<div class="flex h-48 items-center justify-center"><p class="text-sm" style="color:#9c9385">No visits yet</p></div>'
  );
  expect(markup).not.toContain("recharts-responsive-container");
});
