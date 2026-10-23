import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PageFeedProvider } from "@/editor/page-feed-context";
import { type PageFeedSnapshot, pageFeedKey } from "@/editor/page-feeds";
import type { JobsBlock } from "@/editor/types";
import { JobsRender } from "./render";

const block: JobsBlock = {
  heading: "Open roles",
  id: "j1",
  limit: 3,
  seeAll: true,
  source: "auto",
  type: "jobs",
};

const ITEMS = [
  {
    commitment: "",
    deadline: "1. des. 2026",
    deadlineIso: "2026-12-01T10:00:00.000Z",
    department: "BISO Oslo",
    employmentType: "Volunteer",
    href: "/jobs/board",
    id: "a",
    paid: true,
    title: "Board member",
  },
  {
    commitment: "",
    deadline: "",
    department: "BISO Oslo",
    href: "/jobs/host",
    id: "b",
    title: "Host",
  },
];

function html(
  props: Partial<JobsBlock> = {},
  feeds: PageFeedSnapshot = {},
  options: { department?: string; edit?: boolean } = {}
) {
  const { department = "25", edit = false } = options;
  return renderToStaticMarkup(
    <PageFeedProvider department={department} feeds={feeds} locale="no">
      <JobsRender
        block={{ ...block, ...props }}
        edit={edit}
        onPatch={() => undefined}
      />
    </PageFeedProvider>
  );
}

const feeds: PageFeedSnapshot = { [pageFeedKey("jobs", "25", "no", 3)]: ITEMS };

describe("JobsRender", () => {
  test("renders one linked card per feed item", () => {
    const out = html({}, feeds);
    expect(out.match(/<li/g)?.length).toBe(2);
    expect(out).toContain('href="/jobs/board"');
    expect(out).toContain('href="/jobs/host"');
    expect(out).toContain("type-heading-card");
    expect(out).toContain("Volunteer");
    expect(out).toContain("Betalt");
    expect(out).toContain("<time");
    expect(out).toContain('<h2 class="type-heading-section');
    expect(out).toContain('href="/jobs"');
  });

  test("renders nothing on the site without items", () => {
    expect(html({}, { [pageFeedKey("jobs", "25", "no", 3)]: [] })).toBe("");
    expect(html({}, {})).toBe("");
    expect(html({}, feeds, { department: "" })).toBe("");
  });

  test("the editor explains why nothing shows", () => {
    expect(
      html({}, { [pageFeedKey("jobs", "25", "no", 3)]: [] }, { edit: true })
    ).toContain("No open roles for 25");
    expect(html({}, {}, { edit: true })).toContain("Loading…");
    expect(html({}, feeds, { department: "", edit: true })).toContain(
      "Choose a department"
    );
  });

  test("cards are inert in the editor", () => {
    expect(html({}, feeds, { edit: true })).not.toContain('href="/jobs/board"');
  });
});
