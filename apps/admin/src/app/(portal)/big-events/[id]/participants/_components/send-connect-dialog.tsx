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
import { useTranslations } from "next-intl";
import type { ConnectSendMode } from "@/lib/big-events/participant-list";
import { PortalButton } from "../../../../_components/portal-button";
import { SERIF_STACK, STUDIO } from "../../../../_components/studio";

/** Who a toolbar send reaches: people, and the emails they make (one per address). */
export interface ConnectSendReach {
  emails: number;
  people: number;
}

interface SendConnectDialogProps {
  /** The send being confirmed; null when the dialog is closed. */
  mode: ConnectSendMode | null;
  onConfirm: (mode: ConnectSendMode) => void;
  onOpenChange: (open: boolean) => void;
  reach: Record<ConnectSendMode, ConnectSendReach>;
}

/** Asks before a toolbar send queues anything, with how many emails go out (ruling R37). */
export function SendConnectDialog({
  mode,
  onConfirm,
  onOpenChange,
  reach,
}: SendConnectDialogProps) {
  const t = useTranslations("adminPortal.bigEvents.connect");
  const tc = useTranslations("adminPortal.common");
  const counts = mode ? reach[mode] : { emails: 0, people: 0 };
  return (
    <AlertDialog onOpenChange={onOpenChange} open={mode !== null}>
      <AlertDialogContent
        className="border-[#e5dcca] bg-[#fffdf8] sm:rounded-2xl"
        style={{ color: STUDIO.ink }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="break-words font-normal text-[26px] leading-tight"
            style={{ fontFamily: SERIF_STACK }}
          >
            {t("confirmTitle", { emails: counts.emails })}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-sm leading-6"
            style={{ color: STUDIO.ink2 }}
          >
            {t(mode === "all" ? "confirmEveryone" : "confirmNew", {
              people: counts.people,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
          <PortalButton
            onClick={() => {
              if (mode) {
                onConfirm(mode);
              }
            }}
            variant="primary"
          >
            {t("confirm")}
          </PortalButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
