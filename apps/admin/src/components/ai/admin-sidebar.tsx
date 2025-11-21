"use client";

import { domAnimation, LazyMotion, m } from "motion/react";
import { Thread } from "./admin-thread";

export function AssistantSidebar({
  open,
  onOpenChange,
  docked = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  docked?: boolean;
}) {
  return (
    <LazyMotion features={domAnimation}>
      <m.aside
        animate={
          docked
            ? { x: 0, opacity: open ? 1 : 0 }
            : { x: open ? 0 : 384, opacity: open ? 1 : 0 }
        }
        aria-hidden={!open}
        className={
          docked
            ? "aui-root relative z-10 h-full w-full border-l bg-popover"
            : "aui-root fixed top-0 right-0 z-40 h-dvh w-[384px] border-l bg-popover shadow-lg"
        }
        initial={false}
        transition={{ type: "spring", stiffness: 240, damping: 28 }}
      >
        <Thread />
      </m.aside>
    </LazyMotion>
  );
}
