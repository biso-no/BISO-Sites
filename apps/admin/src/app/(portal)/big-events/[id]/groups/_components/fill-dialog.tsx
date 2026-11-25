"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import type { AutoFillPreview } from "@/lib/big-events/buses/fill-run";
import {
  applyAutoFill,
  previewAutoFill,
} from "../../../../_actions/big-event-buses";
import type { GroupView } from "../../../../_actions/big-event-groups";
import { PortalButton } from "../../../../_components/portal-button";
import {
  PortalField,
  PortalSelect,
} from "../../../../_components/portal-fields";
import { SERIF_STACK, STUDIO } from "../../../../_components/studio";
import { useGroupsTabData } from "./groups-view";

/** The scope that fills every campus the caller may fill (`ALL_CAMPUSES` on the server). */
const ALL_CAMPUSES = "all";

type Loaded =
  | { preview: AutoFillPreview; scope: string }
  | { failed: true; scope: string };

/** The most names a preview lists per reason (`NAMES_SHOWN` on the server). */
const NAMES_SHOWN = 10;

interface RoomSize {
  /** People named in it that the caller sees. */
  named: number;
  /** Seats it needs: its places, or the people in it when more. */
  seats: number;
}

/** Each room by the label the preview names it with. */
function roomSizes(
  groups: GroupView[],
  label: (name: string) => string
): Map<string, RoomSize> {
  const sizes = new Map<string, RoomSize>();
  for (const room of groups) {
    if (room.kind !== "room" || sizes.has(label(room.name))) {
      continue;
    }
    const named = new Set(room.members.map((member) => member.participantId));
    sizes.set(label(room.name), {
      named: named.size,
      seats: Math.max(room.capacity ?? 0, named.size),
    });
  }
  return sizes;
}

/**
 * How many people the names leave out: only when the preview cut the list
 * off. A room stands for the people named in it (at least one).
 */
function notNamed(
  entry: AutoFillPreview["unplaced"][number],
  rooms: Map<string, RoomSize>
): number {
  if (entry.names.length < NAMES_SHOWN) {
    return 0;
  }
  const covered = entry.names.reduce(
    (sum, name) => sum + Math.max(rooms.get(name)?.named ?? 1, 1),
    0
  );
  return Math.max(entry.count - covered, 0);
}

/** Why people are left without a seat, one line each (spec D5). */
function UnplacedList({ preview }: { preview: AutoFillPreview }) {
  const t = useTranslations("adminPortal.bigEvents.buses.fill");
  const tp = useTranslations("adminPortal.bigEvents.participants");
  const { view } = useGroupsTabData();
  const rooms = useMemo(
    () => roomSizes(view.groups, (name) => tp("roomName", { name })),
    [view.groups, tp]
  );
  const noSeatLine = (entry: AutoFillPreview["unplaced"][number]) => {
    const headline = t("noSeat", { count: entry.count });
    if (entry.names.length === 0) {
      return headline;
    }
    const names = entry.names.join(", ");
    const more = notNamed(entry, rooms);
    const listed = more > 0 ? t("andMore", { count: more, names }) : names;
    return `${headline} ${t("including", { names: listed })}`;
  };
  const lines = preview.unplaced.flatMap((entry) => {
    if (entry.reason === "no_seat") {
      return [noSeatLine(entry)];
    }
    if (entry.reason === "split_room") {
      return entry.names.map((room) => t("splitRoom", { room }));
    }
    return entry.names.map((room) => {
      const needed = rooms.get(room)?.seats;
      return needed
        ? t("tooBig", { room, seats: needed })
        : t("tooBigUnknown", { room });
    });
  });
  if (lines.length === 0) {
    return null;
  }
  return (
    <ul
      className="flex flex-col gap-1.5 text-sm"
      style={{ color: STUDIO.claret }}
    >
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function PreviewBody({
  allCampuses,
  preview,
}: {
  allCampuses: boolean;
  preview: AutoFillPreview;
}) {
  const t = useTranslations("adminPortal.bigEvents.buses.fill");
  const tb = useTranslations("adminPortal.bigEvents");
  const locale = useLocale();
  if (preview.perBus.length === 0) {
    return <p className="text-sm">{t("noBuses")}</p>;
  }
  const list = new Intl.ListFormat(locale === "no" ? "nb" : "en", {
    type: "conjunction",
  });
  return (
    <div className="flex flex-col gap-4">
      <p className="font-medium text-lg" style={{ color: STUDIO.ink }}>
        {t("summary", {
          buses: preview.perBus.length,
          people: preview.placed,
        })}
      </p>
      <ul
        className="flex flex-col divide-y rounded-xl border text-sm"
        style={{ borderColor: STUDIO.rule }}
      >
        {preview.perBus.map((bus) => (
          <li
            className="flex justify-between gap-3 px-3 py-2"
            key={bus.busId}
            style={{ borderColor: STUDIO.rule }}
          >
            <span>
              {allCampuses
                ? `${bus.name} · ${tb(`campuses.${bus.campusId}`)}`
                : bus.name}
            </span>
            <span style={{ color: STUDIO.ink3 }}>
              {bus.capacity === null
                ? bus.out
                : t("busSeats", { capacity: bus.capacity, out: bus.out })}
            </span>
          </li>
        ))}
      </ul>
      {preview.missingCapacity.length > 0 && (
        <p className="text-sm" style={{ color: STUDIO.claret }}>
          {t("missingCapacity", {
            names: list.format(preview.missingCapacity),
          })}
        </p>
      )}
      <UnplacedList preview={preview} />
    </div>
  );
}

interface FillDialogProps {
  /** Offer "All campuses": the caller manages more than one. */
  allowAll: boolean;
  /** The campus the board shows. */
  campusId: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Fill buses automatically": shows what a fill would do for the campus
 * shown (or all of them), then applies it. The server plans again on apply.
 */
export function FillDialog({
  allowAll,
  campusId,
  onOpenChange,
}: FillDialogProps) {
  const t = useTranslations("adminPortal.bigEvents.buses.fill");
  const tb = useTranslations("adminPortal.bigEvents");
  const tc = useTranslations("adminPortal.common");
  const router = useRouter();
  const { bigEventId, view } = useGroupsTabData();
  const [scope, setScope] = useState(campusId);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [isApplying, startApply] = useTransition();

  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        const preview = await previewAutoFill(bigEventId, scope);
        if (current) {
          setLoaded({ preview, scope });
        }
      } catch {
        if (current) {
          setLoaded({ failed: true, scope });
        }
      }
    };
    load();
    return () => {
      current = false;
    };
  }, [bigEventId, scope]);

  const shown = loaded?.scope === scope ? loaded : null;
  const preview = shown && "preview" in shown ? shown.preview : null;
  const canApply =
    preview !== null &&
    preview.perBus.length > 0 &&
    preview.missingCapacity.length === 0;

  function apply() {
    startApply(async () => {
      try {
        const { moved } = await applyAutoFill(bigEventId, scope);
        toast.success(t("done", { count: moved }));
        onOpenChange(false);
        router.refresh();
      } catch {
        toast.error(tb("form.saveFailed"));
      }
    });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto border-[#e5dcca] bg-[#fffdf8] sm:max-w-lg sm:rounded-2xl"
        style={{ color: STUDIO.ink }}
      >
        <DialogHeader>
          <DialogTitle
            className="break-words font-normal text-[26px] leading-tight"
            style={{ fontFamily: SERIF_STACK }}
          >
            {t("open")}
          </DialogTitle>
          <DialogDescription style={{ color: STUDIO.ink3 }}>
            {t("description")} {t("seatedAgain")}
          </DialogDescription>
        </DialogHeader>
        {view.publishedAt && (
          <p className="text-sm" style={{ color: STUDIO.ink2 }}>
            {t("afterPublishing")}
          </p>
        )}
        {allowAll && (
          <PortalField label={t("scope")}>
            <PortalSelect
              aria-label={t("scope")}
              disabled={isApplying}
              onChange={(e) => setScope(e.target.value)}
              options={[
                { label: tb(`campuses.${campusId}`), value: campusId },
                { label: t("allCampuses"), value: ALL_CAMPUSES },
              ]}
              value={scope}
            />
          </PortalField>
        )}
        {shown === null && (
          <p className="text-sm" style={{ color: STUDIO.ink3 }}>
            {t("loading")}
          </p>
        )}
        {shown !== null && preview === null && (
          <p className="text-sm" style={{ color: STUDIO.claret }}>
            {t("loadFailed")}
          </p>
        )}
        {preview && (
          <PreviewBody allCampuses={scope === ALL_CAMPUSES} preview={preview} />
        )}
        <DialogFooter className="gap-2">
          <PortalButton
            disabled={isApplying}
            onClick={() => onOpenChange(false)}
            variant="ghost"
          >
            {tc("cancel")}
          </PortalButton>
          <PortalButton
            disabled={!canApply}
            loading={isApplying}
            onClick={apply}
            variant="primary"
          >
            {t("apply")}
          </PortalButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
