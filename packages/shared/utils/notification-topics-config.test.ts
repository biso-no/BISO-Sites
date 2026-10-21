import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ALL_PUSH_TOPIC_IDS } from "./notification-topics";

interface ConfigTopic {
  $id: string;
  subscribe: string[];
}

const config = JSON.parse(
  readFileSync(
    new URL("../../api/appwrite.config.json", import.meta.url),
    "utf8"
  )
) as { topics: ConfigTopic[] };

describe("appwrite.config.json push topics", () => {
  it("defines every push topic in appwrite.config.json, subscribable by users", () => {
    const byId = new Map(config.topics.map((topic) => [topic.$id, topic]));
    for (const id of ALL_PUSH_TOPIC_IDS) {
      expect(byId.get(id)?.subscribe, id).toEqual(["users"]);
    }
  });

  it("appwrite.config.json defines exactly the push topics", () => {
    expect(new Set(config.topics.map((topic) => topic.$id))).toEqual(
      new Set(ALL_PUSH_TOPIC_IDS)
    );
  });
});
