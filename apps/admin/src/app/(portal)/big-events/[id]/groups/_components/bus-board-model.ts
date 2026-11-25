import type { Leg } from "@/lib/big-events/buses/seats";
import { NATIONAL_CAMPUS_ID } from "@/lib/event-scope";
import type {
  GroupsView,
  GroupView,
} from "../../../../_actions/big-event-groups";

/* What the bus board shows, worked out from the Groups tab's view. */

/** The drop target of the "Not on a bus yet" column. */
export const NO_BUS = "no-bus";

/** One person on the board. */
export interface BoardChip {
  campusId: string | null;
  /** The bus home, when it isn't the bus of the column they're in. */
  homeBus: string | null;
  name: string;
  /** The one leg they have a seat on, when it's only one. */
  onlyLeg: Leg | null;
  participantId: string;
  /** A seat moved by hand: auto-fill leaves it alone. */
  pinned: boolean;
  roomName: string | null;
}

export interface BoardColumn {
  /** Null for "Not on a bus yet". */
  bus: GroupView | null;
  id: string;
  /** Legs with more people than seats: a warning, never a stop (D5). */
  over: Leg[];
  people: BoardChip[];
}

interface Seated {
  chip: Omit<BoardChip, "homeBus" | "onlyLeg">;
  home: string | null;
  out: string | null;
}

const NAME_COLLATOR = new Intl.Collator("nb");
const LEGS: Leg[] = ["out", "home"];

function isBusCampus(campusId: string | null): campusId is string {
  return campusId !== null && campusId !== NATIONAL_CAMPUS_ID;
}

function busesOf(view: GroupsView): GroupView[] {
  return view.groups.filter((group) => group.kind === "bus");
}

/**
 * The campuses the board offers: the caller's campuses with buses or
 * people, never National (buses belong to a campus, ruling R7). On an empty
 * event, every campus the caller may add buses to.
 */
export function boardCampuses(view: GroupsView): string[] {
  const found = new Set<string>();
  for (const bus of busesOf(view)) {
    if (isBusCampus(bus.campus_id)) {
      found.add(bus.campus_id);
    }
    for (const member of bus.members) {
      if (isBusCampus(member.campusId)) {
        found.add(member.campusId);
      }
    }
  }
  for (const person of view.unseated) {
    if (isBusCampus(person.campusId)) {
      found.add(person.campusId);
    }
  }
  if (found.size === 0) {
    return view.manageableCampuses.filter(isBusCampus);
  }
  return [...found].sort();
}

/** The first campus with a bus, else the first campus offered. */
export function defaultBoardCampus(
  view: GroupsView,
  campuses: string[]
): string | null {
  const withBus = campuses.find((campusId) =>
    busesOf(view).some((bus) => bus.campus_id === campusId)
  );
  return withBus ?? campuses[0] ?? null;
}

/** Each person with a seat on a bus the caller sees, and their bus per leg. */
function seatedPeople(view: GroupsView): Map<string, Seated> {
  const people = new Map<string, Seated>();
  for (const bus of busesOf(view)) {
    for (const member of bus.members) {
      if (member.leg === null) {
        continue;
      }
      const entry = people.get(member.participantId) ?? {
        chip: {
          campusId: member.campusId,
          name: member.name,
          participantId: member.participantId,
          pinned: false,
          roomName: member.roomName,
        },
        home: null,
        out: null,
      };
      entry[member.leg] = bus.$id;
      entry.chip.pinned ||= member.pinned;
      people.set(member.participantId, entry);
    }
  }
  return people;
}

function byName(a: BoardChip, b: BoardChip): number {
  return (
    NAME_COLLATOR.compare(a.name, b.name) ||
    a.participantId.localeCompare(b.participantId)
  );
}

/** The one leg someone rides when they have a seat only one way. */
function onlyLeg(out: string | null, home: string | null): Leg | null {
  if (out === null) {
    return "home";
  }
  return home === null ? "out" : null;
}

function overLegs(bus: GroupView): Leg[] {
  const { capacity, seats } = bus;
  if (capacity === null || !seats) {
    return [];
  }
  return LEGS.filter((leg) => seats[leg] > capacity);
}

/**
 * The board of one campus: "Not on a bus yet" first, then a column per bus.
 * A person sits in the column of their bus out, or of their bus home when
 * they have no way out.
 */
export function boardColumns(
  view: GroupsView,
  campusId: string
): BoardColumn[] {
  const buses = busesOf(view);
  const names = new Map(buses.map((bus) => [bus.$id, bus.name]));
  const byBus = new Map<string, BoardChip[]>();
  for (const { chip, home, out } of seatedPeople(view).values()) {
    const column = out ?? home;
    if (column === null) {
      continue;
    }
    const list = byBus.get(column) ?? [];
    list.push({
      ...chip,
      homeBus: out && home && home !== out ? (names.get(home) ?? null) : null,
      onlyLeg: onlyLeg(out, home),
    });
    byBus.set(column, list);
  }

  const unseated: BoardColumn = {
    bus: null,
    id: NO_BUS,
    over: [],
    people: view.unseated
      .filter((person) => person.campusId === campusId)
      .map((person) => ({
        ...person,
        homeBus: null,
        onlyLeg: null,
        pinned: false,
      })),
  };
  return [
    unseated,
    ...buses
      .filter((bus) => bus.campus_id === campusId)
      .map((bus) => ({
        bus,
        id: bus.$id,
        over: overLegs(bus),
        people: (byBus.get(bus.$id) ?? []).sort(byName),
      })),
  ];
}

/** Which column each person on the board is in. */
export function columnOfPeople(columns: BoardColumn[]): Map<string, string> {
  return new Map(
    columns.flatMap((column) =>
      column.people.map((chip) => [chip.participantId, column.id] as const)
    )
  );
}

/**
 * Who a drop moves: the selection when the dragged person is part of it,
 * otherwise just them; never people already in the target column or no
 * longer on the board.
 */
export function movingPeople(
  activeId: string,
  selection: ReadonlySet<string>,
  columnOf: ReadonlyMap<string, string>,
  targetId: string
): string[] {
  const ids = selection.has(activeId) ? [...selection] : [activeId];
  return ids.filter((id) => {
    const column = columnOf.get(id);
    return column !== undefined && column !== targetId;
  });
}
