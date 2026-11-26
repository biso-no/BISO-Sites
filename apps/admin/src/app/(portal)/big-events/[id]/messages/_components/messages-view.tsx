"use client";

import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { MessageHistoryItem } from "@/lib/big-events/messages/history";
import { listMessages } from "../../../../_actions/big-event-messages";
import {
  SERIF_STACK,
  STUDIO,
  StudioCard,
} from "../../../../_components/studio";
import { Composer, type ComposerProps } from "./composer";
import { HistoryList } from "./history-list";

type MessagesViewProps = Omit<ComposerProps, "onSent"> & {
  history: MessageHistoryItem[];
};

/** The Messages tab: the composer and every message sent or planned. */
export function MessagesView({ history, ...composer }: MessagesViewProps) {
  const t = useTranslations("adminPortal.bigEvents.messages");
  const [items, setItems] = useState(history);
  const { bigEventId } = composer;

  const reload = useCallback(async () => {
    try {
      const result = await listMessages(bigEventId);
      if (result.ok) {
        setItems(result.items);
      }
    } catch {
      toast.error(t("errors.unexpected"));
    }
  }, [bigEventId, t]);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <StudioCard className="flex flex-col gap-4 p-6">
        <h2
          className="text-[26px] leading-tight"
          style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
        >
          {t("newMessage")}
        </h2>
        <Composer {...composer} onSent={reload} />
      </StudioCard>
      <section className="flex flex-col gap-4">
        <h2
          className="text-[26px] leading-tight"
          style={{ color: STUDIO.ink, fontFamily: SERIF_STACK }}
        >
          {t("historyTitle")}
        </h2>
        <HistoryList items={items} onChanged={reload} />
      </section>
    </div>
  );
}
