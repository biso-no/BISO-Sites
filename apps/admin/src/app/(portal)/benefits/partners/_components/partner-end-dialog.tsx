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

export interface PartnerEndDialogProps {
  /** The button that opens it; focus returns there when it closes. */
  children: ReactElement;
  name: string;
  onConfirm: () => void;
  /** Switches to the delete confirmation instead. */
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  /** The offers students see now, which disappear with the partnership. */
  visibleDeals: number;
}

/**
 * Asked before a partnership ends. It says how many offers leave the
 * website, that nothing is lost, and leaves "delete for good" to the side.
 */
export function PartnerEndDialog({
  children,
  name,
  onConfirm,
  onDelete,
  onOpenChange,
  open,
  pending,
  visibleDeals,
}: PartnerEndDialogProps) {
  const t = useTranslations("adminPortal.benefits.partnersPage");
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
            {t("endTitle", { name })}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-sm leading-6"
            style={{ color: STUDIO.ink2 }}
          >
            {t("endBody", { count: visibleDeals })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:items-center">
          <button
            className={`rounded-md px-2 py-2 font-semibold text-sm underline-offset-4 hover:underline disabled:opacity-60 sm:mr-auto ${BOARD_FOCUS_RING}`}
            disabled={pending}
            onClick={onDelete}
            style={{ color: PANEL_ERROR_COLOR }}
            type="button"
          >
            {t("deleteAction")}
          </button>
          <AlertDialogCancel className={BOARD_FOCUS_RING} disabled={pending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className={`gap-2 hover:opacity-90 ${BOARD_FOCUS_RING}`}
            disabled={pending}
            onClick={(event) => {
              // Stay open until the partnership has ended.
              event.preventDefault();
              onConfirm();
            }}
            // Inline, so the theme's button colour can't put ink on claret.
            style={{ background: STUDIO.claret, color: "#fff" }}
          >
            {pending ? (
              <Loader2 aria-hidden className="animate-spin" size={14} />
            ) : null}
            {t("endAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
