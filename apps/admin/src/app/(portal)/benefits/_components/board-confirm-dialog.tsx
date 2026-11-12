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
import type { ReactElement, ReactNode } from "react";
import { SERIF_STACK, STUDIO } from "../../_components/studio";
import { BOARD_FOCUS_RING } from "../_lib/board-styles";
import { PANEL_ERROR_COLOR } from "./panel-fields";

export interface BoardConfirmDialogProps {
  body: ReactNode;
  cancelLabel: string;
  /** Shown between the text and the buttons. */
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  title: ReactNode;
  /** The button that opens it; focus returns there when it closes. */
  trigger: ReactElement;
}

/**
 * The benefits screens' "are you sure" before something can't be undone. The
 * red button stays put while `pending`, and the dialog stays open until the
 * caller closes it.
 */
export function BoardConfirmDialog({
  body,
  cancelLabel,
  children,
  confirmLabel,
  onConfirm,
  onOpenChange,
  open,
  pending,
  title,
  trigger,
}: BoardConfirmDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent
        className="border-[#e5dcca] bg-[#fffdf8] sm:rounded-2xl"
        style={{ color: STUDIO.ink }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle
            className="break-words font-normal text-[26px] leading-tight"
            style={{ fontFamily: SERIF_STACK }}
          >
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription
            className="text-sm leading-6"
            style={{ color: STUDIO.ink2 }}
          >
            {body}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className={BOARD_FOCUS_RING} disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={`gap-2 hover:opacity-90 ${BOARD_FOCUS_RING}`}
            disabled={pending}
            onClick={(event) => {
              // Stay open until the action has finished.
              event.preventDefault();
              onConfirm();
            }}
            style={{ background: PANEL_ERROR_COLOR, color: "#fff" }}
          >
            {pending ? (
              <Loader2 aria-hidden className="animate-spin" size={14} />
            ) : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
