"use client";

import { Bell, Globe, User, Users } from "lucide-react";
import {
  type AudienceContext,
  type AudienceType,
  allowedCampusChoices,
} from "@/lib/announcements/audience-policy";
import { CAMPUS_ID_TO_NAME, CAMPUS_NAME_TO_ID } from "@/lib/campus-constants";
import { DepartmentCombobox } from "../../../_components/department-combobox";
import { type ComposerValues, parseAudiencePeople } from "./composer-state";
import { GroupPicker } from "./group-picker";
import { PeoplePicker } from "./people-picker";
import { ReachBox, type ReachRequest } from "./reach-box";
import { BRAND, FieldLabel, Pill, SERIF } from "./ui";

const NATIONAL_CAMPUS_ID = CAMPUS_NAME_TO_ID.National as string;
const NATIONAL_ONLY_NOTE = "Only national admins can send to every campus.";
const DEFAULT_TOPIC = "events";

const TOPICS = [
  { label: "News", value: "news" },
  { label: "Events", value: "events" },
  { label: "Jobs", value: "jobs" },
  { label: "Shop", value: "shop" },
] as const;

const AUDIENCE_CARDS: Array<{
  description: string;
  icon: typeof Globe;
  id: AudienceType;
  label: string;
}> = [
  {
    description: "Every student with notifications on. Use sparingly.",
    icon: Globe,
    id: "broadcast",
    label: "Everyone at a campus",
  },
  {
    description: "Only students who chose to follow it in the app",
    icon: Bell,
    id: "topic",
    label: "Students who follow a topic",
  },
  {
    description: "Search by name or email",
    icon: User,
    id: "users",
    label: "Specific people",
  },
  {
    description: "e.g. everyone on Bus 2 of the Trondheim trip",
    icon: Users,
    id: "segment",
    label: "A group from an event",
  },
];

type AudiencePatch = Partial<
  Pick<ComposerValues, "audience_type" | "audience_value" | "campus_id">
>;

type PeopleProps = Pick<
  React.ComponentProps<typeof PeoplePicker>,
  "resolve" | "search"
>;
type GroupProps = Pick<
  React.ComponentProps<typeof GroupPicker>,
  "listEvents" | "listGroups"
>;

export interface WhoStepProps extends PeopleProps, GroupProps {
  audienceContext: AudienceContext;
  getReach?: React.ComponentProps<typeof ReachBox>["getReach"];
  /** Overrides the department lookup, for tests. */
  loadDepartments?: React.ComponentProps<
    typeof DepartmentCombobox
  >["loadDepartments"];
  /** "From" is pinned for single-department authors. */
  lockDepartment: boolean;
  set: <K extends keyof ComposerValues>(
    key: K,
    value: ComposerValues[K]
  ) => void;
  /** Changes the audience; the editor also marks it as chosen by the admin. */
  setAudience: (patch: AudiencePatch) => void;
  /** "{title} ({date})" of the linked content, or null when not linked. */
  tappingOpens: string | null;
  values: ComposerValues;
}

function isNationalOrUnset(campusId: string | null | undefined): boolean {
  return !campusId || campusId === NATIONAL_CAMPUS_ID;
}

/** A campus that suits the new audience type, keeping the current one if it does. */
function campusFor(
  ctx: AudienceContext,
  type: AudienceType,
  current: string | null
): string | null {
  const choices = allowedCampusChoices(ctx, type);
  if (type === "users" || type === "segment") {
    // Global admins keep what they had; campus admins get one of their own so
    // scoped history lists show the row.
    if (choices.allCampuses || ctx.roles.includes("globaladmin")) {
      return current;
    }
    return current && choices.campusIds.includes(current)
      ? current
      : (choices.campusIds[0] ?? null);
  }
  if (isNationalOrUnset(current)) {
    return choices.allCampuses ? null : (choices.campusIds[0] ?? null);
  }
  return choices.campusIds.includes(current as string)
    ? current
    : (choices.campusIds[0] ?? null);
}

function AudienceCard({
  active,
  children,
  description,
  disabled,
  icon: Icon,
  label,
  note,
  onChoose,
}: {
  active: boolean;
  children?: React.ReactNode;
  description: string;
  disabled: boolean;
  icon: typeof Globe;
  label: string;
  note?: string;
  onChoose: () => void;
}) {
  return (
    <div
      style={{
        background: active ? "#f2f7fe" : "white",
        border: active
          ? `2px solid ${BRAND.bisoBlue}`
          : `1px solid ${BRAND.rule2}`,
        borderRadius: 12,
        opacity: disabled ? 0.55 : 1,
        padding: active ? "10px 11px" : "11px 12px",
      }}
    >
      <button
        aria-pressed={active}
        disabled={disabled}
        onClick={onChoose}
        style={{
          background: "transparent",
          border: 0,
          color: BRAND.ink,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "block",
          padding: 0,
          textAlign: "left",
          width: "100%",
        }}
        type="button"
      >
        <span
          style={{
            alignItems: "center",
            display: "flex",
            fontSize: 14,
            fontWeight: 700,
            gap: 8,
          }}
        >
          <Icon aria-hidden size={15} />
          {label}
        </span>
        <span
          style={{
            color: BRAND.ink3,
            display: "block",
            fontSize: 12,
            marginTop: 2,
          }}
        >
          {description}
        </span>
      </button>
      {disabled && note && (
        <div style={{ color: BRAND.ink3, fontSize: 12, marginTop: 6 }}>
          {note}
        </div>
      )}
      {active && children && (
        <div
          style={{
            borderTop: `1px dashed ${BRAND.rule2}`,
            marginTop: 10,
            paddingTop: 10,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function CampusPills({
  ctx,
  onPick,
  type,
  value,
}: {
  ctx: AudienceContext;
  onPick: (campusId: string | null) => void;
  type: AudienceType;
  value: string | null;
}) {
  const choices = allowedCampusChoices(ctx, type);
  return (
    <div>
      <FieldLabel>Campus</FieldLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {choices.campusIds.map((id) => (
          <Pill active={value === id} key={id} onClick={() => onPick(id)}>
            {CAMPUS_ID_TO_NAME[id]}
          </Pill>
        ))}
        {choices.allCampuses && (
          <Pill active={isNationalOrUnset(value)} onClick={() => onPick(null)}>
            All campuses
          </Pill>
        )}
        {!choices.allCampuses && (
          <span
            aria-disabled="true"
            style={{
              alignItems: "center",
              color: BRAND.ink4,
              display: "inline-flex",
              fontSize: 12.5,
              gap: 8,
            }}
          >
            <span
              style={{
                border: `1px dashed ${BRAND.rule2}`,
                borderRadius: 999,
                padding: "5px 11px",
              }}
            >
              All campuses
            </span>
            {NATIONAL_ONLY_NOTE}
          </span>
        )}
      </div>
    </div>
  );
}

function reachRequest(values: ComposerValues): ReachRequest {
  const request: ReachRequest = {
    audienceType: values.audience_type,
    audienceValue: values.audience_value ?? null,
    campusId: values.campus_id ?? null,
  };
  if (values.audience_type === "users") {
    request.userIds = parseAudiencePeople(values.audience_value);
  }
  return request;
}

export function WhoStep({
  audienceContext,
  getReach,
  listEvents,
  listGroups,
  loadDepartments,
  lockDepartment,
  resolve,
  search,
  set,
  setAudience,
  tappingOpens,
  values,
}: WhoStepProps) {
  const type = values.audience_type;
  const campusId = values.campus_id ?? null;

  const choose = (next: AudienceType) => {
    if (next === type) {
      return;
    }
    const topicValue = next === "topic" ? DEFAULT_TOPIC : "";
    setAudience({
      audience_type: next,
      audience_value: topicValue,
      campus_id: campusFor(audienceContext, next, campusId),
    });
  };

  const hasCampusChoice = (card: AudienceType) => {
    const choices = allowedCampusChoices(audienceContext, card);
    return choices.allCampuses || choices.campusIds.length > 0;
  };

  return (
    <div>
      <div style={{ padding: "8px 0 4px" }}>
        <div
          style={{
            color: BRAND.ink,
            fontFamily: SERIF,
            fontSize: 40,
            letterSpacing: "-0.015em",
            lineHeight: 1.05,
          }}
        >
          Who should get it?
        </div>
        <p
          style={{
            color: BRAND.ink3,
            fontSize: 14,
            lineHeight: 1.5,
            margin: "10px 0 0",
          }}
        >
          Everyone gets it in their own language, Norwegian or English, and only
          once.
        </p>
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
        {AUDIENCE_CARDS.map((card) => {
          const needsCampus = card.id === "broadcast" || card.id === "topic";
          const disabled = needsCampus && !hasCampusChoice(card.id);
          return (
            <AudienceCard
              active={type === card.id}
              description={card.description}
              disabled={disabled}
              icon={card.icon}
              key={card.id}
              label={card.label}
              note={NATIONAL_ONLY_NOTE}
              onChoose={() => choose(card.id)}
            >
              {card.id === "topic" && (
                <div style={{ marginBottom: 12 }}>
                  <FieldLabel>Topic</FieldLabel>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 6,
                    }}
                  >
                    {TOPICS.map((topic) => (
                      <Pill
                        active={values.audience_value === topic.value}
                        key={topic.value}
                        onClick={() =>
                          setAudience({ audience_value: topic.value })
                        }
                      >
                        {topic.label}
                      </Pill>
                    ))}
                  </div>
                </div>
              )}
              {needsCampus && (
                <CampusPills
                  ctx={audienceContext}
                  onPick={(id) => setAudience({ campus_id: id })}
                  type={card.id}
                  value={campusId}
                />
              )}
              {card.id === "users" && (
                <PeoplePicker
                  onChange={(ids) =>
                    setAudience({
                      audience_value: ids.length ? JSON.stringify(ids) : "",
                    })
                  }
                  resolve={resolve}
                  search={search}
                  value={parseAudiencePeople(values.audience_value)}
                />
              )}
              {card.id === "segment" && (
                <GroupPicker
                  listEvents={listEvents}
                  listGroups={listGroups}
                  onChange={(segmentId, segmentCampus) =>
                    setAudience({
                      audience_value: segmentId ?? "",
                      ...(segmentId ? { campus_id: segmentCampus } : {}),
                    })
                  }
                  value={values.audience_value || null}
                />
              )}
            </AudienceCard>
          );
        })}
      </div>

      <ReachBox
        getReach={getReach}
        request={reachRequest(values)}
        tappingOpens={tappingOpens}
      />

      <div style={{ marginTop: 26 }}>
        <FieldLabel help="Leave empty to send as BISO">
          Sent on behalf of
        </FieldLabel>
        <div style={{ marginTop: 6 }}>
          <DepartmentCombobox
            campusId={campusId}
            disabled={lockDepartment}
            initialDepartments={[]}
            loadDepartments={loadDepartments}
            onChange={(id) => set("department_id", id)}
            placeholder="Campus-wide (no department)"
            value={values.department_id ?? null}
          />
        </div>
      </div>
    </div>
  );
}
