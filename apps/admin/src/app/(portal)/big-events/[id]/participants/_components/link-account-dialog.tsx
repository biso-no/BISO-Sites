"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type ParticipantListItem,
  participantName,
} from "@/lib/big-events/participant-list";
import {
  type LinkCandidate,
  linkParticipantManually,
  searchAccountsForLink,
  unlinkParticipantAction,
} from "../../../../_actions/big-event-linking";
import { PortalButton } from "../../../../_components/portal-button";
import { PortalInput } from "../../../../_components/portal-fields";
import { SERIF_STACK, STUDIO } from "../../../../_components/studio";

const MIN_QUERY_LENGTH = 2;
const SEARCH_DELAY_MS = 250;
const DIALOG_CLASS = "border-[#e5dcca] bg-[#fffdf8] sm:rounded-2xl";

type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "done"; results: LinkCandidate[] }
  | { status: "failed" };

interface LinkAccountDialogProps {
  bigEventId: string;
  onOpenChange: (open: boolean) => void;
  /** The person to link; the dialog is open while set. */
  row: ParticipantListItem | null;
}

/** Search BI-linked accounts by name or email and link one to the person. */
export function LinkAccountDialog({
  bigEventId,
  onOpenChange,
  row,
}: LinkAccountDialogProps) {
  const t = useTranslations("adminPortal.bigEvents.link");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ status: "idle" });
  const [isLinking, startLink] = useTransition();
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setSearch({ status: "idle" });
      return;
    }
    let cancelled = false;
    setSearch({ status: "searching" });
    const timer = setTimeout(async () => {
      try {
        const results = await searchAccountsForLink(bigEventId, trimmed);
        if (!cancelled) {
          setSearch({ results, status: "done" });
        }
      } catch {
        if (!cancelled) {
          setSearch({ status: "failed" });
        }
      }
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bigEventId, trimmed]);

  function link(candidate: LinkCandidate) {
    if (!row) {
      return;
    }
    startLink(async () => {
      try {
        const result = await linkParticipantManually(row.$id, candidate.id);
        if (!result.ok) {
          toast.error(t(`refused.${result.reason}`));
          return;
        }
        toast.success(
          t("linked", { email: candidate.email, name: participantName(row) })
        );
        onOpenChange(false);
        router.refresh();
      } catch {
        toast.error(t("failed"));
      }
    });
  }

  const name = row ? participantName(row) : "";

  return (
    <Dialog onOpenChange={onOpenChange} open={row !== null}>
      <DialogContent className={DIALOG_CLASS} style={{ color: STUDIO.ink }}>
        <DialogHeader>
          <DialogTitle
            className="break-words font-normal text-[26px] leading-tight"
            style={{ fontFamily: SERIF_STACK }}
          >
            {t("dialog.title", { name })}
          </DialogTitle>
          <DialogDescription style={{ color: STUDIO.ink3 }}>
            {t("dialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            size={14}
            style={{ color: STUDIO.ink4 }}
          />
          <PortalInput
            aria-label={t("dialog.search")}
            autoComplete="off"
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("dialog.search")}
            type="search"
            value={query}
          />
        </div>
        <SearchResults disabled={isLinking} onChoose={link} search={search} />
      </DialogContent>
    </Dialog>
  );
}

function SearchResults({
  disabled,
  onChoose,
  search,
}: {
  disabled: boolean;
  onChoose: (candidate: LinkCandidate) => void;
  search: SearchState;
}) {
  const t = useTranslations("adminPortal.bigEvents.link.dialog");
  const muted = { color: STUDIO.ink3 };
  if (search.status === "idle") {
    return (
      <p className="text-sm" style={muted}>
        {t("minChars")}
      </p>
    );
  }
  if (search.status === "searching") {
    return (
      <p className="text-sm" style={muted}>
        {t("searching")}
      </p>
    );
  }
  if (search.status === "failed") {
    return (
      <p className="text-sm" style={{ color: STUDIO.claret }}>
        {t("searchFailed")}
      </p>
    );
  }
  if (search.results.length === 0) {
    return (
      <p className="text-sm" style={muted}>
        {t("noResults")}
      </p>
    );
  }
  return (
    <ul
      className="max-h-80 overflow-y-auto rounded-xl border"
      style={{ borderColor: STUDIO.rule }}
    >
      {search.results.map((candidate) => (
        <li
          className="flex items-center gap-3 border-t px-4 py-3 first:border-t-0"
          key={candidate.id}
          style={{ borderColor: STUDIO.rule }}
        >
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium" style={{ color: STUDIO.ink }}>
              {candidate.name}
            </p>
            <p className="break-all text-xs" style={{ color: STUDIO.ink3 }}>
              {[candidate.email, candidate.campusName]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {candidate.hasTicketHere && (
              <p className="mt-0.5 text-xs" style={{ color: STUDIO.claret }}>
                {t("hasTicket")}
              </p>
            )}
          </div>
          <PortalButton
            disabled={disabled || candidate.hasTicketHere}
            onClick={() => onChoose(candidate)}
            size="sm"
          >
            {t("choose")}
          </PortalButton>
        </li>
      ))}
    </ul>
  );
}

interface UnlinkAccountDialogProps {
  onOpenChange: (open: boolean) => void;
  /** The person to unlink; the dialog is open while set. */
  row: ParticipantListItem | null;
}

/** Confirms taking a ticket off its account; the person stays on the list. */
export function UnlinkAccountDialog({
  onOpenChange,
  row,
}: UnlinkAccountDialogProps) {
  const t = useTranslations("adminPortal.bigEvents.link");
  const tc = useTranslations("adminPortal.common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const name = row ? participantName(row) : "";

  function confirm() {
    if (!row) {
      return;
    }
    startTransition(async () => {
      try {
        await unlinkParticipantAction(row.$id);
        toast.success(t("unlinked", { name }));
        onOpenChange(false);
        router.refresh();
      } catch {
        toast.error(t("failed"));
      }
    });
  }

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!isPending) {
          onOpenChange(open);
        }
      }}
      open={row !== null}
    >
      <AlertDialogContent
        className={DIALOG_CLASS}
        style={{ color: STUDIO.ink }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="break-words font-normal text-[26px] leading-tight"
            style={{ fontFamily: SERIF_STACK }}
          >
            {t("unlinkDialog.title", { name })}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-sm leading-6"
            style={{ color: STUDIO.ink2 }}
          >
            {t("unlinkDialog.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={isPending}>
            {tc("cancel")}
          </AlertDialogCancel>
          <PortalButton loading={isPending} onClick={confirm} variant="danger">
            {t("unlinkDialog.confirm")}
          </PortalButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
