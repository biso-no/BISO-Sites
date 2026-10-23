import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PageFeedProvider } from "@/editor/page-feed-context";
import {
  type PageFeedSnapshot,
  pageFeedKey,
  teamSource,
} from "@/editor/page-feeds";
import type { TeamBlock } from "@/editor/types";
import { TeamRender } from "./render";

const block: TeamBlock = {
  heading: "Styret",
  id: "t1",
  members: [
    {
      email: "leder@example.org",
      name: "Kari Eksempel",
      phone: "+47 000 00 001",
      role: "Leder",
    },
    { name: "Ola Testesen", role: "Nestleder" },
  ],
  showContact: true,
  source: "manual",
  type: "team",
};

const BOARD_KEY = pageFeedKey("board", "25");
const BOARD = [
  {
    email: "okonomi@example.org",
    name: "Fiona Fiktiv",
    photo: { src: "data:image/png;base64,AAAA" },
    role: "Okonomiansvarlig",
  },
  { name: "Gunnar Gjenstand", role: "Medlem" },
];

function html(
  props: Partial<TeamBlock> = {},
  feeds: PageFeedSnapshot = { [BOARD_KEY]: BOARD },
  options: { department?: string; edit?: boolean; surface?: boolean } = {}
) {
  const node = (
    <PageFeedProvider
      department={options.department ?? "25"}
      feeds={feeds}
      locale="no"
    >
      <TeamRender
        block={{ ...block, ...props }}
        edit={options.edit ?? false}
        onPatch={() => undefined}
      />
    </PageFeedProvider>
  );
  return renderToStaticMarkup(
    options.surface ? <section data-surface="deep">{node}</section> : node
  );
}

describe("TeamRender", () => {
  test("the board source renders the feed members, photo included", () => {
    const out = html({ members: [], source: "board" });
    expect(out).toContain("Fiona Fiktiv");
    expect(out).toContain("Gunnar Gjenstand");
    expect(out).toContain('src="data:image/png;base64,AAAA"');
  });

  test("the board source with an empty or missing feed renders nothing on the site", () => {
    expect(html({ source: "board" }, { [BOARD_KEY]: [] })).toBe("");
    expect(html({ source: "board" }, {})).toBe("");
    expect(
      html({ source: "board" }, { [BOARD_KEY]: BOARD }, { department: "" })
    ).toBe("");
  });

  test("the editor says why a board is empty", () => {
    expect(
      html({ source: "board" }, { [BOARD_KEY]: [] }, { edit: true })
    ).toContain("No board members for 25");
    expect(
      html({ source: "board" }, {}, { department: "", edit: true })
    ).toContain("Choose a department");
  });

  test("showContact false renders no mailto or tel link", () => {
    const out = html({ showContact: false });
    expect(out).toContain("Kari Eksempel");
    expect(out).not.toContain("mailto:");
    expect(out).not.toContain("tel:");
    expect(html({ showContact: false, source: "board" })).not.toContain(
      "mailto:"
    );
  });

  test("a board team renders no tel link, even if a feed item carries a phone", () => {
    const out = html(
      { source: "board" },
      {
        [BOARD_KEY]: [
          { name: "Fiona", phone: "+47 000 00 009", role: "Leder" },
        ],
      }
    );
    expect(out).toContain("Fiona");
    expect(out).not.toContain("tel:");
  });

  test("showContact true renders mailto and tel links", () => {
    const out = html();
    expect(out).toContain('href="mailto:leder@example.org"');
    expect(out).toContain('href="tel:+4700000001"');
  });

  test("members sit in a card grid of PersonCards with their position", () => {
    const out = html();
    expect(out).toContain("@3xl:grid-cols-4");
    expect(out).toContain("Leder");
    expect(out).toContain("Nestleder");
  });

  test("the manual source shows the authored members, nothing when none", () => {
    expect(html({ members: [] })).toBe("");
  });

  test("unknown source is manual, missing showContact shows contacts", () => {
    expect(teamSource("weird")).toBe("manual");
    expect(teamSource(undefined)).toBe("manual");
    expect(teamSource("board")).toBe("board");
    const out = html({ showContact: undefined, source: "weird" as never });
    expect(out).toContain("mailto:");
  });

  test("tolerates junk members and renders on a dark section", () => {
    const out = html(
      { members: [null, "x", { role: "no name" }, ...block.members] as never },
      {},
      { surface: true }
    );
    expect(out).toContain("Kari Eksempel");
    expect(out).toContain("text-ink");
  });
});
