import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { useTranslations } from "next-intl";
import { SERIF_STACK, STUDIO } from "../../_components/studio";
import { BOARD_FOCUS_RING } from "../_lib/board-styles";

export interface BenefitDiscardDialogProps {
  onDiscard: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Where focus goes back to when the editor keeps editing. */
  returnFocus: () => void;
}

/** Asked before a panel with unsaved changes closes. */
export function BenefitDiscardDialog({
  onDiscard,
  onOpenChange,
  open,
  returnFocus,
}: BenefitDiscardDialogProps) {
  const t = useTranslations("adminPortal.benefits.panel");
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent
        className="border-[#e5dcca] bg-[#fffdf8] sm:rounded-2xl"
        // There is no trigger to return to; go back to where the editor was.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus();
        }}
        style={{ color: STUDIO.ink }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="font-normal text-[26px] leading-tight"
            style={{ fontFamily: SERIF_STACK }}
          >
            {t("discardTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-sm leading-6"
            style={{ color: STUDIO.ink2 }}
          >
            {t("discardBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className={BOARD_FOCUS_RING}>
            {t("keepEditing")}
          </AlertDialogCancel>
          <AlertDialogAction
            className={`hover:opacity-90 ${BOARD_FOCUS_RING}`}
            onClick={onDiscard}
            // Inline, so the theme's button colour can't put ink on claret.
            style={{ background: STUDIO.claret, color: "#fff" }}
          >
            {t("discard")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
