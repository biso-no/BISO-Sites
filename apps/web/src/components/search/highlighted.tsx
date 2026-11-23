import type { Segment } from "@repo/shared/search/response";
import { Fragment } from "react";

const MARK_CLASS =
  "rounded-[2px] bg-marker text-deep [box-decoration-break:clone]";

/** Renders API segments; matched text gets the marker. Text is never parsed as HTML. */
export function Highlighted({
  segments,
  className,
}: {
  segments: Segment[];
  className?: string;
}) {
  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark className={MARK_CLASS} key={index}>
            {segment.text}
          </mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        )
      )}
    </span>
  );
}
