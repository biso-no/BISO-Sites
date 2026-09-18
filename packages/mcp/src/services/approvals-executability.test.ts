/**
 * Whether an approval can actually be completed.
 *
 * Being in the admin app's `PUBLISH_ACTIONS` is not the same as being
 * executable by whoever approves. `executeApprovalPublish` writes the status
 * change with the **approver's session client** for every domain except
 * `events` (which routes through `publishEvent`) and `shop` (which the admin
 * app explicitly writes with the admin client, for exactly this reason). So
 * Appwrite's table permissions decide whether an approval does anything.
 *
 * This package files approval requests but does not execute them, so the honest
 * thing is to say at filing time which domains dead-end rather than to take
 * over an execution path the portal owns.
 */

import { describe, expect, test } from "bun:test";
import {
  APPROVAL_EXECUTION_NOTES,
  EXECUTABLE_APPROVAL_DOMAINS,
} from "./approvals";

describe("APPROVAL_EXECUTION_NOTES", () => {
  test("covers every fileable domain", () => {
    for (const domain of EXECUTABLE_APPROVAL_DOMAINS) {
      expect(APPROVAL_EXECUTION_NOTES).toHaveProperty(domain);
    }
  });

  test("flags the domains no approver can complete today", () => {
    // `campus_benefits` and `news` grant no table-level update, and drafts this
    // package creates carry no row-level update grant either.
    expect(APPROVAL_EXECUTION_NOTES.benefits).toBeTruthy();
    expect(APPROVAL_EXECUTION_NOTES.news).toBeTruthy();
  });

  test("flags the domains only some approvers can complete", () => {
    // `documents` grants update to Operations Unit alone; `jobs` to Operations
    // Unit and HR.
    expect(APPROVAL_EXECUTION_NOTES.documents).toContain("Operations Unit");
    expect(APPROVAL_EXECUTION_NOTES.jobs).toContain("Operations Unit");
  });

  test("leaves the two domains with their own execution path unflagged", () => {
    // `events` goes through `publishEvent()`, `shop` through the admin client.
    expect(APPROVAL_EXECUTION_NOTES.events).toBeNull();
    expect(APPROVAL_EXECUTION_NOTES.shop).toBeNull();
  });

  test("a note never claims the request cannot be filed", () => {
    // Filing works for every domain; it is completion that may not. A note that
    // blurred the two would send a requester to the wrong person.
    for (const note of Object.values(APPROVAL_EXECUTION_NOTES)) {
      if (note) {
        expect(note.toLowerCase()).toContain("approv");
      }
    }
  });
});
