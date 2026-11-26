"use client";

import type { MessageStatus } from "@repo/shared/big-events/tables";
import { Pin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { MessageError } from "@/lib/big-events/messages/draft";
import type { MessageHistoryItem } from "@/lib/big-events/messages/history";
import {
  cancelMessage,
  retryMessage,
  unpinMessage,
} from "../../../../_actions/big-event-messages";
import { PortalButton } from "../../../../_components/portal-button";
import { STUDIO } from "../../../../_components/studio";
import { otherLocale } from "./composer-state";
import { countsLine, whenLine, whoLine } from "./history-text";
import { IMPORTANT_RED } from "./ui";

const STATUS_COLOR: Record<MessageStatus, string> = {
  failed: STUDIO.claret,
  scheduled: STUDIO.sky,
  sending: STUDIO.gold,
  sent: STUDIO.leaf,
};

interface HistoryListProps {
  items: MessageHistoryItem[];
  /** After an action: the list is loaded again. */
  onChanged: () => Promise<void> | void;
}

/**
 * Every message the caller may see, newest first (plan M10): title, when,
 * who, counts, "Automatic" for the cron's, Important with Unpin, Cancel
 * while planned, and Try again after a failure.
 */
export function HistoryList({ items, onChanged }: HistoryListProps) {
  const t = useTranslations("adminPortal.bigEvents.messages.history");
  if (items.length === 0) {
    return (
      <p className="text-sm" style={{ color: STUDIO.ink3 }}>
        {t("empty")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <HistoryEntry item={item} key={item.id} onChanged={onChanged} />
      ))}
    </ul>
  );
}

function Badge({ children, color }: { children: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[11px] uppercase tracking-[0.05em]"
      style={{ border: `0.5px solid ${color}`, color }}
    >
      {children}
    </span>
  );
}

function HistoryEntry({
  item,
  onChanged,
}: {
  item: MessageHistoryItem;
  onChanged: () => Promise<void> | void;
}) {
  const t = useTranslations("adminPortal.bigEvents.messages");
  const tb = useTranslations("adminPortal.bigEvents");
  const locale = useLocale() === "no" ? "no" : "en";
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const title = item.title[locale] || item.title[otherLocale(locale)];
  const when = whenLine(item, locale, t);
  const counts = countsLine(item, t);
  const who = whoLine(item, t, (id) => tb(`campuses.${id}`));

  /** Runs one action, says how it went, then loads the list again. */
  function act(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
      } catch {
        toast.error(t("errors.unexpected"));
      }
      await onChanged();
    });
  }

  const refused = (error: MessageError) => toast.error(t(`errors.${error}`));

  const unpin = () =>
    act(async () => {
      let unpinned = false;
      let refusal: MessageError | null = null;
      for (const id of item.messageIds) {
        const result = await unpinMessage(id);
        if (result.ok) {
          unpinned = true;
        } else {
          refusal ??= result.error;
        }
      }
      if (unpinned) {
        toast.success(t("history.unpinned"));
      } else if (refusal) {
        refused(refusal);
      }
    });

  const cancel = () =>
    act(async () => {
      setConfirming(false);
      const result = await cancelMessage(item.id);
      if (result.ok) {
        toast.success(t("history.cancelled"));
      } else if (result.error === "already_sent") {
        // The list was loaded a while ago; it is now too close to sending.
        toast.error(t("history.tooLateToCancel"));
      } else {
        refused(result.error);
      }
    });

  const retry = () =>
    act(async () => {
      const statuses: MessageStatus[] = [];
      let refusal: MessageError | null = null;
      for (const id of item.retryIds) {
        const result = await retryMessage(id);
        if (result.ok) {
          statuses.push(result.status);
        } else {
          refusal ??= result.error;
        }
      }
      if (statuses.includes("failed")) {
        toast.error(t("history.retryFailed"));
      } else if (refusal) {
        refused(refusal);
      } else if (statuses.some((status) => status !== "sent")) {
        toast.info(t("history.retrySending"));
      } else {
        toast.success(t("history.retried"));
      }
    });

  return (
    <li
      className="flex flex-col gap-1.5 rounded-xl px-4 py-3"
      style={{
        background: "rgba(255,255,255,0.55)",
        border: `0.5px solid ${item.important ? IMPORTANT_RED : STUDIO.rule}`,
      }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge color={STATUS_COLOR[item.status]}>
          {t(`history.status.${item.status}`)}
        </Badge>
        {item.automatic && (
          <Badge color={STUDIO.ink3}>{t("history.automatic")}</Badge>
        )}
        {item.important && (
          <Badge color={IMPORTANT_RED}>{t("history.important")}</Badge>
        )}
        {item.pinned && (
          <>
            <Pin aria-hidden size={13} style={{ color: IMPORTANT_RED }} />
            <span className="sr-only">{t("history.pinned")}</span>
          </>
        )}
      </div>
      <h3
        className="font-medium text-[15px]"
        style={{ color: item.important ? IMPORTANT_RED : STUDIO.ink }}
      >
        {title}
      </h3>
      <p className="text-sm" style={{ color: STUDIO.ink2 }}>
        {[when, who].filter(Boolean).join(" · ")}
      </p>
      {counts && (
        <p className="text-xs" style={{ color: STUDIO.ink3 }}>
          {counts}
        </p>
      )}
      {item.retryIds.length > 0 && (
        <p className="text-xs" style={{ color: STUDIO.ink3 }}>
          {t("history.retryHelp")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {item.retryIds.length > 0 && (
          <PortalButton loading={isPending} onClick={retry} size="sm">
            {t("history.retry")}
          </PortalButton>
        )}
        {item.canUnpin && (
          <PortalButton disabled={isPending} onClick={unpin} size="sm">
            {t("history.unpin")}
          </PortalButton>
        )}
        {item.canCancel && !confirming && (
          <PortalButton
            disabled={isPending}
            onClick={() => setConfirming(true)}
            size="sm"
            variant="ghost"
          >
            {t("history.cancel")}
          </PortalButton>
        )}
        {item.canCancel && confirming && (
          <>
            <span className="text-sm" style={{ color: STUDIO.ink2 }}>
              {t("history.cancelQuestion")}
            </span>
            <PortalButton
              loading={isPending}
              onClick={cancel}
              size="sm"
              variant="danger"
            >
              {t("history.cancelConfirm")}
            </PortalButton>
            <PortalButton
              disabled={isPending}
              onClick={() => setConfirming(false)}
              size="sm"
              variant="ghost"
            >
              {t("history.cancelKeep")}
            </PortalButton>
          </>
        )}
      </div>
    </li>
  );
}
