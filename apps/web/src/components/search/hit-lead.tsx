import type { SearchHit } from "@repo/shared/search/response";
import { ImageWithFallback } from "@repo/ui/components/image";
import { cn } from "@repo/ui/lib/utils";
import { ChevronFrame } from "@/components/ui/chevron-frame";
import { DateBlock } from "@/components/ui/date-block";
import { dateOfSeconds, leadOf } from "./hit-meta";

/**
 * A result's lead visual (see `leadOf`): an event's date block, or a news or
 * product picture in the chevron frame. Renders nothing otherwise, so the
 * text column aligns. No hooks, so a server-rendered row can use it too.
 */
export function HitLead({
  hit,
  locale,
  size,
}: {
  hit: SearchHit;
  /** `Intl` locale for the date block, e.g. "nb-NO". */
  locale: string;
  size: "large" | "small";
}) {
  const kind = leadOf(hit);
  if (kind === "date" && hit.starts_at !== null) {
    return <DateBlock date={dateOfSeconds(hit.starts_at)} locale={locale} />;
  }
  if (kind === "image" && hit.image) {
    const large = size === "large";
    return (
      <ChevronFrame
        className={cn(
          "shrink-0 bg-surface-sunken",
          large ? "mb-1 w-full" : "w-16"
        )}
        ratio={large ? "16/9" : "4/3"}
      >
        {/* `alt=""`: the title next to it names the result. */}
        <ImageWithFallback
          alt=""
          height={large ? 324 : 96}
          sizes={large ? "288px" : "64px"}
          src={hit.image}
          width={large ? 576 : 128}
        />
      </ChevronFrame>
    );
  }
  return null;
}
