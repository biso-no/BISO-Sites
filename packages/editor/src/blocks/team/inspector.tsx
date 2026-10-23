"use client";

import { listOf } from "@/blocks/_v2/list";
import type { PatchFn } from "@/blocks/types";
import {
  InspRow,
  InspSection,
  Segmented,
} from "@/components/editor-shell/inspector/insp-parts";
import { ItemList } from "@/components/editor-shell/inspector/item-list";
import { MediaPicker } from "@/components/editor-shell/inspector/media-picker";
import { teamSource } from "@/editor/page-feeds";
import type { PageDoc, TeamBlock, TeamMember } from "@/editor/types";

interface Props {
  block: TeamBlock;
  doc: PageDoc;
  onPatch: PatchFn;
}

const SOURCES = [
  { label: "Manual", value: "manual" },
  { label: "Board", value: "board" },
] as const;

const CONTACT = [
  { label: "Show", value: "show" },
  { label: "Hide", value: "hide" },
] as const;

export function TeamInspector({ block, onPatch }: Props) {
  const source = teamSource(block.source);
  return (
    <>
      <InspSection label="Team">
        <InspRow label="Heading">
          <input
            onChange={(e) => onPatch("heading", e.target.value)}
            value={block.heading ?? ""}
          />
        </InspRow>
        <InspRow label="Source">
          <Segmented
            choices={[...SOURCES]}
            onPick={(v) => onPatch("source", v)}
            value={source}
          />
        </InspRow>
        <InspRow label="Contact details">
          <Segmented
            choices={[...CONTACT]}
            onPick={(v) => onPatch("showContact", v === "show")}
            value={block.showContact === false ? "hide" : "show"}
          />
        </InspRow>
        {source === "board" ? (
          <p className="pe-insp-note">
            Shows the elected board of this page's department, read from
            Microsoft 365. Set the department on the Page tab.
          </p>
        ) : null}
      </InspSection>
      {source === "manual" ? (
        <InspSection label="Members">
          <ItemList<TeamMember>
            addLabel="+ Add member"
            items={listOf<TeamMember>(block.members)}
            newItem={() => ({ name: "Name", role: "Role" })}
            onChange={(members) => onPatch("members", members)}
            renderItem={(item, update) => (
              <>
                <InspRow label="Name">
                  <input
                    onChange={(e) => update({ ...item, name: e.target.value })}
                    value={item.name ?? ""}
                  />
                </InspRow>
                <InspRow label="Role">
                  <input
                    onChange={(e) => update({ ...item, role: e.target.value })}
                    value={item.role ?? ""}
                  />
                </InspRow>
                <InspRow label="Email">
                  <input
                    onChange={(e) =>
                      update({ ...item, email: e.target.value || undefined })
                    }
                    type="email"
                    value={item.email ?? ""}
                  />
                </InspRow>
                <InspRow label="Phone">
                  <input
                    onChange={(e) =>
                      update({ ...item, phone: e.target.value || undefined })
                    }
                    value={item.phone ?? ""}
                  />
                </InspRow>
                <MediaPicker
                  accept="image/*"
                  onClear={() => update({ ...item, photo: undefined })}
                  onPicked={(fileId, url, mime) =>
                    update({
                      ...item,
                      photo: { fileId, mime: mime || undefined, src: url },
                    })
                  }
                  onUrl={(url) =>
                    update({ ...item, photo: url ? { src: url } : undefined })
                  }
                  src={item.photo?.src}
                />
              </>
            )}
            title={(item) => item.name || "Member"}
          />
        </InspSection>
      ) : null}
    </>
  );
}
