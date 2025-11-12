"use client";

import { Thread } from "./admin-thread";
import { LazyMotion, domAnimation, m } from "motion/react";
import { useAssistantUIStore } from "./assistant-ui-store";

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
				initial={false}
				animate={docked ? { x: 0, opacity: open ? 1 : 0 } : { x: open ? 0 : 384, opacity: open ? 1 : 0 }}
				transition={{ type: "spring", stiffness: 240, damping: 28 }}
				className={
					docked
						? "aui-root relative z-10 h-full w-full border-l bg-popover"
						: "aui-root fixed right-0 top-0 z-40 h-dvh w-[384px] border-l bg-popover shadow-lg"
				}
				aria-hidden={!open}
			>
				<Thread />
			</m.aside>
		</LazyMotion>
	);
}


