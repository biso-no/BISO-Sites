import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import { AREAS } from "./areas";

/** The logo is drawn for navy: it sits in the navy header bar. */
const LOGO_SIZE = 30;

export const navTitle = (
  <>
    <Image
      alt="BISO"
      height={LOGO_SIZE}
      src="/biso-logo-on-navy.png"
      width={LOGO_SIZE}
    />
    <span className="font-bold font-display text-[15px]">Docs</span>
  </>
);

export function baseOptions(): BaseLayoutProps {
  return {
    nav: { title: navTitle },
    // Header only: in the sidebar and the mobile menu, AreaSwitch does this job.
    links: AREAS.map((area) => ({
      type: "main",
      text: area.title,
      url: area.href,
      active: "nested-url",
      on: "nav",
    })),
  };
}
