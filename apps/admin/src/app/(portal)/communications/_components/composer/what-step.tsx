"use client";

import { Check, Link2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { getLinkedContentPrefill } from "@/app/(portal)/_actions/composer";
import {
  isNationalOrUnset,
  TOPIC_NAMES,
} from "@/lib/announcements/audience-names";
import { isAudienceAllowed } from "@/lib/announcements/audience-policy";
import type { LinkableItem } from "@/lib/announcements/composer-lookups";
import {
  applyLinkedAudience,
  applyPrefill,
  type ComposerLinkType,
  type ComposerTopic,
  type ComposerTypeId,
  type ComposerValues,
  type PrefillSnapshot,
  TYPE_CARDS,
} from "./composer-state";
import { ContentPicker } from "./content-picker";
import type { LinkedDisplay, LinkState, StoredLink } from "./link-state";
import {
  BRAND,
  FieldLabel,
  type LocaleCode,
  LocaleTabs,
  SERIF,
  TYPE_ICONS,
} from "./ui";

const NOUN: Record<ComposerLinkType, string> = {
  event: "event",
  job: "position",
  news: "article",
};

interface LinkedPrefill extends PrefillSnapshot {
  campusId: string | null;
  item: LinkableItem;
  label: string;
  topic: ComposerTopic;
}

type LoadPrefill = (
  type: ComposerLinkType,
  id: string
) => Promise<LinkedPrefill | null>;

export interface WhatStepProps {
  audienceContext: { managedCampusIds: string[]; roles: string[] };
  /** True once the admin changed the audience in this session. */
  audienceTouched: boolean;
  link: LinkState;
  loadPrefill?: LoadPrefill;
  locale: LocaleCode;
  search?: React.ComponentProps<typeof ContentPicker>["search"];
  set: <K extends keyof ComposerValues>(
    key: K,
    value: ComposerValues[K]
  ) => void;
  setLink: (link: LinkState) => void;
  setLocale: (locale: LocaleCode) => void;
  /** What the saved row says about its link, for when it can't be loaded. */
  storedLink?: StoredLink | null;
  /** Replaces the form values in one step, from the latest ones. */
  update: (change: (previous: ComposerValues) => ComposerValues) => void;
  values: ComposerValues;
}

function withLinkFields(
  values: ComposerValues,
  type: ComposerLinkType | null,
  id: string | null
): ComposerValues {
  return {
    ...values,
    content_id: id,
    content_type: type,
    event_id: type === "event" ? id : null,
  };
}

function labelFor(item: LinkableItem): string {
  return item.dateLabel ? `${item.title} (${item.dateLabel})` : item.title;
}

function metaFor(item: LinkableItem): string {
  return [item.dateLabel, item.campusName].filter(Boolean).join(" · ");
}

/** A card for a link that couldn't be loaded, from what the row stored. */
function storedDisplay(
  type: ComposerLinkType,
  id: string,
  stored: StoredLink | null | undefined
): LinkedDisplay {
  return {
    id,
    image: stored?.image ?? null,
    meta: "",
    title: stored?.title || `Linked ${NOUN[type]}`,
  };
}

function TypeCard({
  active,
  description,
  id,
  label,
  onChoose,
}: {
  active: boolean;
  description: string;
  id: ComposerTypeId;
  label: string;
  onChoose: () => void;
}) {
  const Icon = TYPE_ICONS[id];
  const accent = id === "urgent" ? BRAND.red : BRAND.ink;
  return (
    <button
      aria-pressed={active}
      onClick={onChoose}
      style={{
        background: active ? "white" : "rgba(255,255,255,.55)",
        border: active ? `1.5px solid ${accent}` : `0.5px solid ${BRAND.rule2}`,
        borderRadius: 12,
        boxShadow: active ? "0 2px 8px rgba(0,0,0,.06)" : "none",
        color: BRAND.ink,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: active ? "13.5px 15.5px" : "14px 16px",
        position: "relative",
        textAlign: "left",
        transition: "border-color .12s, background .12s",
      }}
      type="button"
    >
      <span
        style={{
          alignItems: "center",
          background: active ? accent : BRAND.paper2,
          borderRadius: 8,
          color: active ? "white" : BRAND.ink2,
          display: "grid",
          height: 28,
          marginBottom: 4,
          placeItems: "center",
          width: 28,
        }}
      >
        <Icon size={14} />
      </span>
      <b style={{ fontSize: 14, fontWeight: 600 }}>{label}</b>
      <small style={{ color: BRAND.ink3, fontSize: 12, lineHeight: 1.4 }}>
        {description}
      </small>
      {active && (
        <span
          aria-hidden
          style={{
            alignItems: "center",
            background: BRAND.leaf,
            borderRadius: "50%",
            color: "white",
            display: "grid",
            height: 16,
            placeItems: "center",
            position: "absolute",
            right: 10,
            top: 10,
            width: 16,
          }}
        >
          <Check size={10} />
        </span>
      )}
    </button>
  );
}

export function WhatStep({
  audienceContext,
  audienceTouched,
  link,
  loadPrefill = getLinkedContentPrefill as LoadPrefill,
  locale,
  search,
  set,
  setLink,
  setLocale,
  storedLink,
  update,
  values,
}: WhatStepProps) {
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const linkRef = useRef(link);
  linkRef.current = link;
  // Bumped by every pick, clear and type change, so a prefill response that
  // arrives after the admin moved on is ignored.
  const requestRef = useRef(0);

  const card = TYPE_CARDS.find((item) => item.id === values.category);
  const linkType = card?.linkType ?? null;
  const titleKey = locale === "en" ? "title_en" : "title_no";
  const titleValue =
    locale === "en" ? values.title_en : (values.title_no ?? "");

  // A draft reopens with an id but no card: look up its name.
  const hasLink = Boolean(values.content_id && values.content_type);
  const needsDisplay = hasLink && !link.display;
  const storedLinkRef = useRef(storedLink);
  storedLinkRef.current = storedLink;
  useEffect(() => {
    if (!(needsDisplay && values.content_type && values.content_id)) {
      return;
    }
    let cancelled = false;
    const type = values.content_type;
    const id = values.content_id;
    // The link stays: keep a card from what the row stored, and say so.
    const keepStoredCard = () => {
      if (cancelled) {
        return;
      }
      setLink({
        ...linkRef.current,
        display: storedDisplay(type, id, storedLinkRef.current),
        tip: `Couldn't load the linked ${NOUN[type]}.`,
        tipQuiet: true,
      });
    };
    loadPrefill(type, id)
      .then((found) => {
        if (cancelled) {
          return;
        }
        if (!found) {
          keepStoredCard();
          return;
        }
        setLink({
          ...linkRef.current,
          display: {
            id,
            image: found.item.image,
            label: found.label,
            meta: metaFor(found.item),
            title: found.item.title,
          },
        });
      })
      .catch(keepStoredCard);
    return () => {
      cancelled = true;
    };
  }, [
    needsDisplay,
    values.content_type,
    values.content_id,
    loadPrefill,
    setLink,
  ]);

  const chooseType = (id: ComposerTypeId) => {
    requestRef.current += 1;
    const nextLinkType =
      TYPE_CARDS.find((item) => item.id === id)?.linkType ?? null;
    const dropsLink =
      valuesRef.current.content_type !== null &&
      valuesRef.current.content_type !== nextLinkType;
    update((previous) => {
      const next = { ...previous, category: id };
      return dropsLink ? withLinkFields(next, null, null) : next;
    });
    if (dropsLink) {
      // The snapshot stays: text it filled in is still replaceable later.
      setLink({ ...linkRef.current, display: null, tip: null });
    }
  };

  const clearLink = () => {
    requestRef.current += 1;
    update((previous) => withLinkFields(previous, null, null));
    setLink({ ...linkRef.current, display: null, tip: null });
  };

  const pick = async (item: LinkableItem) => {
    if (!linkType) {
      return;
    }
    const display = {
      id: item.id,
      image: item.image,
      label: labelFor(item),
      meta: metaFor(item),
      title: item.title,
    };
    requestRef.current += 1;
    const request = requestRef.current;
    const previousSnapshot = linkRef.current.snapshot;
    update((previous) => withLinkFields(previous, linkType, item.id));
    setLink({ display, snapshot: previousSnapshot, tip: null });

    let found: LinkedPrefill | null = null;
    try {
      found = await loadPrefill(linkType, item.id);
    } catch {
      found = null;
    }
    if (request !== requestRef.current) {
      return;
    }
    if (!found) {
      setLink({
        display,
        snapshot: previousSnapshot,
        tip: `Couldn't fill in the text from the ${NOUN[linkType]}. Write it yourself.`,
        tipQuiet: true,
      });
      return;
    }
    const snapshot: PrefillSnapshot = {
      body_en: found.body_en,
      body_no: found.body_no,
      title_en: found.title_en,
      title_no: found.title_no,
    };
    const allowed = isAudienceAllowed(audienceContext, {
      audienceType: "topic",
      campusId: found.campusId,
    });
    const build = (base: ComposerValues) => {
      const filled = applyPrefill(
        withLinkFields(base, linkType, item.id),
        snapshot,
        previousSnapshot
      );
      return {
        filled,
        final: applyLinkedAudience(
          filled,
          { campusId: found.campusId, topic: found.topic },
          { allowed, audienceTouched }
        ),
      };
    };
    const outcome = build(valuesRef.current);
    const audienceSet = outcome.final !== outcome.filled;
    update((previous) => build(previous).final);

    const campusLabel = isNationalOrUnset(found.campusId)
      ? "all campuses"
      : item.campusName;
    const tip = `✓ Title and text filled in from the ${NOUN[linkType]}. Edit freely.${
      audienceSet
        ? ` Audience set to ${TOPIC_NAMES[found.topic]} · ${campusLabel}.`
        : ""
    }`;
    setLink({ display, snapshot, tip });
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
          What is this about?
        </div>
        <p
          style={{
            color: BRAND.ink3,
            fontSize: 14,
            lineHeight: 1.5,
            margin: "10px 0 0",
          }}
        >
          Pick a type. If it's about something on the website, link it, and
          students go straight there when they tap.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          marginTop: 18,
        }}
      >
        {TYPE_CARDS.map((item) => (
          <TypeCard
            active={values.category === item.id}
            description={item.description}
            id={item.id}
            key={item.id}
            label={item.label}
            onChoose={() => chooseType(item.id)}
          />
        ))}
      </div>

      {linkType && (
        <div style={{ display: "grid", gap: 6, marginTop: 22 }}>
          <FieldLabel
            help={card?.linkRequired ? undefined : "Optional"}
            required={card?.linkRequired}
          >
            <Link2 size={12} /> Which {NOUN[linkType]}?
          </FieldLabel>
          <ContentPicker
            onClear={clearLink}
            onPick={pick}
            search={search}
            type={linkType}
            value={link.display}
          />
          {link.tip && (
            <div
              style={{
                background: link.tipQuiet ? BRAND.paper2 : "#eef4ee",
                borderRadius: 9,
                color: link.tipQuiet ? BRAND.ink3 : BRAND.green,
                fontSize: 12.5,
                lineHeight: 1.5,
                marginTop: 2,
                padding: "8px 11px",
              }}
            >
              {link.tip}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 26 }}>
        <FieldLabel required>Title</FieldLabel>
        <div style={{ marginTop: 8 }}>
          <LocaleTabs
            locale={locale}
            pendingNo={!values.title_no?.trim()}
            setLocale={setLocale}
          />
        </div>
        <input
          aria-label={locale === "en" ? "Title in English" : "Tittel på norsk"}
          onChange={(event) =>
            set(
              titleKey,
              locale === "en" ? event.target.value : event.target.value || null
            )
          }
          placeholder={
            locale === "en"
              ? "A headline students can't miss…"
              : "En overskrift studentene ikke kan overse…"
          }
          style={{
            appearance: "none",
            background: "transparent",
            border: 0,
            color: BRAND.ink,
            fontFamily: SERIF,
            fontSize: 44,
            fontWeight: 400,
            letterSpacing: "-0.018em",
            lineHeight: 1.05,
            outline: 0,
            padding: 0,
            width: "100%",
          }}
          type="text"
          value={titleValue}
        />
      </div>
    </div>
  );
}
