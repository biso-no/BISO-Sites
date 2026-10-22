import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactElement } from "react";
import { SERIF_STACK, STUDIO } from "../../../_components/studio";
import { PANEL_ERROR_COLOR } from "../../_components/panel-fields";
import { BOARD_FOCUS_RING } from "../../_lib/board-styles";

export interface PartnerDeleteDialogProps {
  /** The button that opens it; focus returns there when it closes. */
  children: ReactElement;
  /** Every offer linked to the partner: they are deleted with it. */
  deals: { id: string; title: string }[];
  name: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
}

/** The last "are you sure": names every offer that goes with the partner. */
export function PartnerDeleteDialog({
  children,
  deals,
  name,
  onConfirm,
  onOpenChange,
  open,
  pending,
}: PartnerDeleteDialogProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
  const hasDeals = deals.length > 0;
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent
        className="border-[#e5dcca] bg-[#fffdf8] sm:rounded-2xl"
        style={{ color: STUDIO.ink }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="break-words font-normal text-[26px] leading-tight"
            style={{ fontFamily: SERIF_STACK }}
          >
            {t("deleteTitle", { name })}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-sm leading-6"
            style={{ color: STUDIO.ink2 }}
          >
            {hasDeals ? t("deleteBody") : t("deleteBodyNoDeals")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hasDeals ? (
          <ul
            className="max-h-56 overflow-y-auto rounded-xl border bg-white px-4 py-1 text-sm"
            style={{ borderColor: STUDIO.rule, color: STUDIO.ink }}
          >
            {deals.map((deal) => (
              <li
                className="border-t border-dashed py-2 first:border-t-0"
                key={deal.id}
                style={{ borderColor: STUDIO.rule }}
              >
                {deal.title}
              </li>
            ))}
          </ul>
        ) : null}
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className={BOARD_FOCUS_RING} disabled={pending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className={`gap-2 hover:opacity-90 ${BOARD_FOCUS_RING}`}
            disabled={pending}
            onClick={(event) => {
              // Stay open until the delete has finished.
              event.preventDefault();
              onConfirm();
            }}
            style={{ background: PANEL_ERROR_COLOR, color: "#fff" }}
          >
            {pending ? (
              <Loader2 aria-hidden className="animate-spin" size={14} />
            ) : null}
            {t("deleteAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
