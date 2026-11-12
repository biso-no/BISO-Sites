import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StepIntro } from "./ui";

test("StepIntro renders the eyebrow above a 40px serif title", () => {
  expect(
    renderToStaticMarkup(<StepIntro eyebrow="Step 2" title="The message." />)
  ).toBe(
    renderToStaticMarkup(
      <div style={{ padding: "8px 0 18px" }}>
        <span
          style={{
            color: "#9c9385",
            fontSize: 11,
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Step 2
        </span>
        <div
          style={{
            color: "#1a1814",
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 40,
            letterSpacing: "-0.015em",
            lineHeight: 1.05,
            marginTop: 4,
          }}
        >
          The message.
        </div>
      </div>
    )
  );
});

// The event studio's steps used to spell this heading out by hand: no
// eyebrow, the title with no top margin, then a lead paragraph.
const EVENT_HEADINGS = [
  {
    lead: "Once the date is in, calendar buttons and reminders wire themselves up automatically. Capacity sets the cut-off for the waitlist.",
    title: "When, where, how many.",
  },
  {
    lead: "Where people get tickets or sign up goes in the ticket link: the event page shows it as a Get tickets button. BISO sells no event tickets itself, so a paid event needs one.",
    title: "Doors, tickets, who's invited.",
  },
  {
    lead: "Click any row to jump back and edit. When you're happy, hit Publish — the event goes on biso.no and the BISO app at the same moment.",
    title: "One last look.",
  },
];

for (const { lead, title } of EVENT_HEADINGS) {
  test(`StepIntro without an eyebrow renders the event heading "${title}" as before`, () => {
    expect(renderToStaticMarkup(<StepIntro lead={lead} title={title} />)).toBe(
      renderToStaticMarkup(
        <div style={{ padding: "8px 0 18px" }}>
          <div
            style={{
              color: "#1a1814",
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 40,
              letterSpacing: "-0.015em",
              lineHeight: 1.05,
            }}
          >
            {title}
          </div>
          <p
            style={{
              color: "#6b6357",
              fontSize: 13.5,
              margin: "8px 0 0",
              maxWidth: "50ch",
            }}
          >
            {lead}
          </p>
        </div>
      )
    );
  });
}
