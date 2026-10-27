import Link from "next/link";
import { AskField } from "./ask-field";

/**
 * The landing's opening band. Navy on the left, for the people who use the
 * platform; sky on the right, with navy text, for whoever takes over running
 * it. From 768px the two sit side by side in a 360px band, and the sky
 * panel's left edge leans 13°: its top corner is cut in by 360px × tan(13°)
 * (0.2309). Below 768px they stack and the edge goes.
 *
 * Both panels are fixed brand colours, so the band looks the same in dark mode.
 */
export function SplitHero() {
  return (
    <section
      className="bg-deep md:grid md:h-[360px] md:grid-cols-[3fr_2fr]"
      data-surface="deep"
    >
      <div className="px-4 pt-10 pb-12 md:px-6 md:py-[42px]">
        <h1 className="mb-3.5 max-w-[6.5em] text-balance font-black font-display text-[length:clamp(2.5rem,6vw,3.625rem)] text-ink uppercase leading-[0.88] tracking-[-0.02em]">
          How BISO runs
        </h1>
        <p className="mb-5 max-w-[36ch] text-[15px] text-ink-muted">
          Step-by-step guides for board members, HR, department editors and
          campus leaders.
        </p>
        <AskField />
      </div>
      <div className="bg-sky px-4 pt-9 pb-10 text-deep md:pt-[42px] md:pr-7 md:pb-10 md:pl-[calc(360px*0.2309_+_24px)] md:[clip-path:polygon(calc(360px*0.2309)_0,100%_0,100%_100%,0_100%)]">
        <h2 className="mb-3 max-w-[8em] text-balance font-black font-display text-[32px] uppercase leading-[0.88] tracking-[-0.02em]">
          Keeping it running
        </h2>
        <p className="mb-[18px] max-w-[28ch] text-sm">
          For the developer or consultant who takes over: what runs where, how
          to deploy, what to do when it breaks.
        </p>
        <Link
          className="inline-block rounded-biso-sm border-2 border-deep px-3.5 py-[7px] font-bold text-[13px] transition-colors hover:bg-deep hover:text-paper focus-visible:outline-2 focus-visible:outline-deep focus-visible:outline-offset-2"
          href="/developers"
        >
          Start the handover
        </Link>
      </div>
    </section>
  );
}
