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
import {
  createContext,
  type ReactNode,
  useContext,
  useId,
  useMemo,
  useState,
  useTransition,
} from "react";
import { PortalButton } from "../../../../_components/portal-button";
import { SERIF_STACK, STUDIO } from "../../../../_components/studio";

/** A move that may change someone's bus. */
export interface MoveRequest {
  /** False when the move can't change anyone's bus: it runs without asking. */
  ask?: boolean;
  /** The people moved, by name. */
  names: string[];
  /** Runs the move; `notify` is "Tell them about the change". Shows its own toasts. */
  run: (notify: boolean) => Promise<void>;
  /** Where they go, e.g. "Bus 2 · Both ways". */
  summary: string;
}

interface MoveConfirmApi {
  /** After publishing, asks first whether to tell the people (D5); otherwise runs the move. */
  confirmMove: (request: MoveRequest) => void;
  /** A move is being saved. */
  pending: boolean;
  /** The bus lists are published: bus changes may be told to the people. */
  published: boolean;
}

const MoveConfirmContext = createContext<MoveConfirmApi | null>(null);

/** The Groups tab's moves: bus moves and room moves ask the same way (ruling R14). */
export function useMoveConfirm(): MoveConfirmApi {
  const api = useContext(MoveConfirmContext);
  if (!api) {
    throw new Error("useMoveConfirm is only available inside GroupsTab");
  }
  return api;
}

interface TellCheckboxProps {
  checked: boolean;
  names: string[];
  onChange: (checked: boolean) => void;
}

/** "Tell {name} about the change", ticked by default where it's used (D5). */
export function TellCheckbox({ checked, names, onChange }: TellCheckboxProps) {
  const t = useTranslations("adminPortal.bigEvents.buses.confirm");
  const id = useId();
  return (
    <label
      className="flex items-center gap-2.5 text-sm"
      htmlFor={id}
      style={{ color: STUDIO.ink }}
    >
      <input
        checked={checked}
        className="h-4 w-4 shrink-0 accent-[#6b1e1e]"
        id={id}
        // Toggled from state: the browser's own toggle and ours agree.
        onChange={() => onChange(!checked)}
        type="checkbox"
      />
      {t("tell", { count: names.length, name: names[0] ?? "" })}
    </label>
  );
}

interface MoveConfirmProviderProps {
  children: ReactNode;
  published: boolean;
}

/** Holds the confirm every move on the Groups tab goes through. */
export function MoveConfirmProvider({
  children,
  published,
}: MoveConfirmProviderProps) {
  const t = useTranslations("adminPortal.bigEvents.buses.confirm");
  const tc = useTranslations("adminPortal.common");
  const [request, setRequest] = useState<MoveRequest | null>(null);
  const [tell, setTell] = useState(true);
  const [pending, startMove] = useTransition();

  const api = useMemo<MoveConfirmApi>(
    () => ({
      confirmMove: (next) => {
        if (published && next.ask !== false) {
          setTell(true);
          setRequest(next);
          return;
        }
        startMove(() => next.run(false));
      },
      pending,
      published,
    }),
    [pending, published]
  );

  function confirm() {
    const current = request;
    if (!current) {
      return;
    }
    startMove(async () => {
      await current.run(tell);
      setRequest(null);
    });
  }

  const names = request?.names ?? [];
  return (
    <MoveConfirmContext.Provider value={api}>
      {children}
      <AlertDialog
        onOpenChange={(open) => {
          if (!(open || pending)) {
            setRequest(null);
          }
        }}
        open={request !== null}
      >
        <AlertDialogContent
          className="border-[#e5dcca] bg-[#fffdf8] sm:rounded-2xl"
          style={{ color: STUDIO.ink }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className="break-words font-normal text-[26px] leading-tight"
              style={{ fontFamily: SERIF_STACK }}
            >
              {t("title", { count: names.length, name: names[0] ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription
              className="text-sm leading-6"
              style={{ color: STUDIO.ink2 }}
            >
              <span className="block font-medium" style={{ color: STUDIO.ink }}>
                {request?.summary}
              </span>
              {t("published")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <TellCheckbox checked={tell} names={names} onChange={setTell} />
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={pending}>
              {tc("cancel")}
            </AlertDialogCancel>
            <PortalButton loading={pending} onClick={confirm} variant="primary">
              {t("move")}
            </PortalButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MoveConfirmContext.Provider>
  );
}
