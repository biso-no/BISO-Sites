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
import { SERIF_STACK, STUDIO } from "../../_components/studio";
import { BOARD_FOCUS_RING } from "../_lib/board-styles";
import { PANEL_ERROR_COLOR } from "./panel-fields";

export interface BenefitDeleteDialogProps {
  /** The button that opens it; focus returns there when it closes. */
  children: ReactElement;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  /** The benefit's title, as the board shows it. */
  title: string;
}

/** A plain "are you sure" before a benefit is deleted for good. */
export function BenefitDeleteDialog({
  children,
  onConfirm,
  onOpenChange,
  open,
  pending,
  title,
}: BenefitDeleteDialogProps) {
  const t = useTranslations("adminPortal.benefits.panel");
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
            {t("deleteTitle", { title })}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-sm leading-6"
            style={{ color: STUDIO.ink2 }}
          >
            {t("deleteBody")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className={BOARD_FOCUS_RING} disabled={pending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className={`gap-2 text-white hover:opacity-90 ${BOARD_FOCUS_RING}`}
            disabled={pending}
            onClick={(event) => {
              // Stay open until the delete has finished.
              event.preventDefault();
              onConfirm();
            }}
            style={{ background: PANEL_ERROR_COLOR }}
          >
            {pending ? (
              <Loader2 aria-hidden className="animate-spin" size={14} />
            ) : null}
            {t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
