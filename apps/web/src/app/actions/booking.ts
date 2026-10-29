"use server";

import { createHash } from "node:crypto";
import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  JobApplications,
  JobInterviewParticipants,
  JobInterviews,
  Jobs,
  RecruitmentBookingTokens,
} from "@repo/api/types/appwrite";
import {
  JobInterviewParticipantsResponseStatus,
  JobInterviewParticipantsRole,
  JobInterviewsStatus,
} from "@repo/api/types/appwrite";
import type {
  JobInterviewParticipantWriteInput,
  JobInterviewWriteInput,
} from "@repo/api/types/inputs";
import { createTypedRow } from "@repo/api/write";
import {
  createSchedulingGraphClient,
  panelBusyIntervals,
  scheduleInterviewOnGraph,
} from "@repo/connectors/azure/recruitment-scheduling";
import { sendEmail } from "@repo/connectors/email";
import { buildRecruitmentStaffRowPermissions } from "@repo/shared/recruitment";
import {
  BOOKING_LINK_UNAVAILABLE_MESSAGE,
  isBookingLinkUsable,
} from "@repo/shared/recruitment/booking-link";
import { availableSlots } from "@repo/shared/recruitment/booking-slots";
import {
  parseBookingPanel,
  type RecruitmentBookingPanelMember,
  recruitmentBookingConfirmSchema,
} from "@repo/shared/types/recruitment";

const SECRET = process.env.RECRUITMENT_BOOKING_SECRET;
const TIMEZONE = "Europe/Oslo";
/** A candidate may not book anything starting sooner than this. */
const LEAD_TIME_MS = 2 * 60 * 60_000;
const SLOT_STEP_MINUTES = 30;
const DEFAULT_ADMIN_BASE_URL = "https://admin.biso.no";
const TRAILING_SLASHES = /\/+$/;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export interface BookingContext {
  application: { applicant_name: string; applicant_email: string };
  /** Whether the slots reflect the panel's calendars, or only office hours. */
  availabilityChecked: boolean;
  job: { $id: string; slug: string; campus_name: string | null };
  /** ISO start times the candidate may choose from. */
  slots: string[];
  token: {
    duration_minutes: number;
    expires_at: string;
    window_from: string;
    window_to: string;
  };
}

type Db = Awaited<ReturnType<typeof createAdminClient>>["db"];

async function loadToken(
  db: Db,
  token: string
): Promise<{ record: RecruitmentBookingTokens } | { error: string }> {
  const result = await db.listRows<RecruitmentBookingTokens>(
    "app",
    "recruitment_booking_tokens",
    [Query.equal("token_hash", hashToken(token)), Query.limit(1)]
  );
  const record = result.rows[0];
  if (!record) {
    return { error: "This booking link is invalid." };
  }
  if (record.consumed_at) {
    return { error: "This booking link has already been used." };
  }
  if (Date.now() > new Date(record.expires_at).getTime()) {
    return { error: "This booking link has expired." };
  }
  return { record };
}

/**
 * Loads the application and vacancy behind a token and refuses the link when
 * the candidate is no longer in the interview stage or the vacancy is closed.
 * The refusal reads like an expired link and says nothing about the candidate.
 */
async function loadBookableApplication(
  db: Db,
  record: RecruitmentBookingTokens,
  jobSelect: string[]
): Promise<{ application: JobApplications; job: Jobs } | { error: string }> {
  const application = await db.getRow<JobApplications>(
    "app",
    "job_applications",
    record.application_id
  );
  const job = await db.getRow<Jobs>("app", "jobs", application.job_id, [
    Query.select([...jobSelect, "status"]),
  ]);
  if (
    !isBookingLinkUsable({
      applicationStatus: application.status,
      jobStatus: job.status,
    })
  ) {
    return { error: BOOKING_LINK_UNAVAILABLE_MESSAGE };
  }
  return { application, job };
}

/**
 * The slots a candidate can pick: office hours inside the token's window,
 * minus whatever the panel already has in their calendars.
 */
async function bookingSlots(
  record: RecruitmentBookingTokens,
  panel: RecruitmentBookingPanelMember[]
): Promise<{ availabilityChecked: boolean; slots: Date[] }> {
  const from = new Date(
    Math.max(new Date(record.window_from).getTime(), Date.now() + LEAD_TIME_MS)
  );
  const to = new Date(record.window_to);
  const graph = createSchedulingGraphClient();
  const upns = panel.map((member) => member.email);
  const freeBusy =
    graph && upns.length > 0
      ? await panelBusyIntervals(graph, upns, { from, to })
      : null;
  return {
    availabilityChecked: freeBusy?.complete ?? false,
    slots: availableSlots({
      busy: freeBusy?.busy ?? [],
      durationMinutes: record.duration_minutes,
      from,
      stepMinutes: SLOT_STEP_MINUTES,
      timeZone: TIMEZONE,
      to,
    }),
  };
}

/** Tokens issued before the panel carried emails parse to an empty panel. */
function panelFromToken(
  record: RecruitmentBookingTokens
): RecruitmentBookingPanelMember[] {
  const panel = parseBookingPanel(record.panel_user_ids);
  if (panel.length === 0 && record.panel_user_ids) {
    console.warn(
      `[Booking] Token ${record.$id} predates panel emails; no calendar check or invite is possible.`
    );
  }
  return panel;
}

export async function getBookingContext(
  token: string
): Promise<{ data: BookingContext } | { error: string }> {
  if (!SECRET) {
    return { error: "Booking is not configured." };
  }

  const { db } = await createAdminClient();
  const loaded = await loadToken(db, token);
  if ("error" in loaded) {
    return loaded;
  }
  const { record } = loaded;

  const bookable = await loadBookableApplication(db, record, [
    "$id",
    "slug",
    "campus.name",
  ]);
  if ("error" in bookable) {
    return bookable;
  }
  const { application, job } = bookable;
  const { availabilityChecked, slots } = await bookingSlots(
    record,
    panelFromToken(record)
  );

  return {
    data: {
      application: {
        applicant_email: application.applicant_email,
        applicant_name: application.applicant_name,
      },
      availabilityChecked,
      job: {
        $id: job.$id,
        campus_name:
          (job as unknown as { campus?: { name: string } }).campus?.name ??
          null,
        slug: job.slug,
      },
      slots: slots.map((slot) => slot.toISOString()),
      token: {
        duration_minutes: record.duration_minutes,
        expires_at: record.expires_at,
        window_from: record.window_from,
        window_to: record.window_to,
      },
    },
  };
}

async function createParticipant(
  db: Db,
  interviewId: string,
  input: Omit<
    JobInterviewParticipantWriteInput,
    "interview" | "interview_id" | "response_status"
  >
): Promise<JobInterviewParticipants> {
  return await createTypedRow<
    JobInterviewParticipants,
    JobInterviewParticipantWriteInput
  >(
    db,
    "app",
    "job_interview_participants",
    ID.unique(),
    {
      ...input,
      interview: interviewId,
      interview_id: interviewId,
      response_status: JobInterviewParticipantsResponseStatus.PENDING,
    },
    buildRecruitmentStaffRowPermissions()
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function jobTitleOf(job: Jobs): string {
  const translations = (job as unknown as { translations?: unknown })
    .translations;
  if (Array.isArray(translations)) {
    const titles = translations as { locale?: string; title?: string }[];
    const preferred = titles.find((row) => row.locale === "no") ?? titles[0];
    if (preferred?.title) {
      return preferred.title;
    }
  }
  return job.slug ?? "the vacancy";
}

/**
 * Tell the person who issued the booking link that the interview was booked
 * but no calendar invite went out, and leave an audit row. Never throws: the
 * candidate's booking stands whether or not staff could be reached.
 */
async function alertInviteFailed(
  db: Db,
  users: { get: (args: { userId: string }) => Promise<{ email?: string }> },
  details: {
    candidateName: string;
    creatorUserId: string | null;
    interviewId: string;
    job: Jobs;
    startsAt: string;
  }
): Promise<void> {
  const { candidateName, creatorUserId, interviewId, job, startsAt } = details;
  const jobTitle = jobTitleOf(job);
  const when = new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: TIMEZONE,
  }).format(new Date(startsAt));
  const baseUrl = (
    process.env.ADMIN_BASE_URL ?? DEFAULT_ADMIN_BASE_URL
  ).replace(TRAILING_SLASHES, "");
  const link = `${baseUrl}/jobs/${job.$id}/applications`;

  let notified = false;
  try {
    if (!creatorUserId) {
      throw new Error("The booking link has no owner to notify.");
    }
    const { email } = await users.get({ userId: creatorUserId });
    if (!email) {
      throw new Error("The booking link's owner has no email address.");
    }
    await sendEmail({
      html: `<p>${escapeHtml(candidateName)} booked an interview for ${escapeHtml(jobTitle)} on ${escapeHtml(when)}, but the calendar invite could not be sent.</p><p>Please send the invite manually or contact the candidate.</p><p><a href="${escapeHtml(link)}">Open the applications</a></p>`,
      subject: `Interview invite not sent: ${candidateName}`,
      text: `${candidateName} booked an interview for ${jobTitle} on ${when}, but the calendar invite could not be sent.\n\nPlease send the invite manually or contact the candidate.\n\n${link}`,
      to: email,
    });
    notified = true;
  } catch (error) {
    console.error(
      "[Booking] Could not alert staff about a failed invite:",
      error
    );
  }

  try {
    await db.createRow("app", "audit_logs", ID.unique(), {
      action: "recruitment.booking.invite_failed",
      actor_email: null,
      actor_id: "system:booking",
      payload: JSON.stringify({ notified, starts_at: startsAt }),
      resource_id: interviewId,
      resource_type: "job_interview",
    });
  } catch (error) {
    console.error("[Booking] Audit write failed for a failed invite:", error);
  }
}

/**
 * Create the Teams meeting and the Outlook invite for a booked interview.
 * Returns the interview as updated with the meeting details, or the
 * original one when the calendar is not connected or refuses the event.
 */
async function inviteEveryone(
  db: Db,
  interview: JobInterviews,
  candidateEmail: string,
  panel: RecruitmentBookingPanelMember[]
): Promise<{ interview: JobInterviews; invited: boolean }> {
  const graph = createSchedulingGraphClient();
  const organizer =
    panel.find((member) => member.is_lead)?.email ?? panel[0]?.email ?? null;
  if (!(graph && organizer)) {
    return { interview, invited: false };
  }
  try {
    const scheduled = await scheduleInterviewOnGraph(graph, {
      body: "Interview with BISO, booked through your booking link.",
      candidateEmail,
      createTeamsMeeting: true,
      ends_at: new Date(interview.ends_at as string),
      location: "Teams",
      organizerUpn: organizer,
      panelEmails: panel.map((member) => member.email),
      starts_at: new Date(interview.starts_at as string),
      subject: interview.title,
      timezone: TIMEZONE,
    });
    if (!scheduled.outlookEventId) {
      return { interview, invited: false };
    }
    const updated = await db.updateRow<JobInterviews>(
      "app",
      "job_interviews",
      interview.$id,
      {
        meeting_url: scheduled.meetingUrl,
        outlook_event_id: scheduled.outlookEventId,
        teams_meeting_id: scheduled.teamsMeetingId,
      }
    );
    return { interview: updated, invited: true };
  } catch (error) {
    console.warn("[Booking] Calendar invite failed:", error);
    return { interview, invited: false };
  }
}

export async function confirmBookingSlot(
  token: string,
  startsAt: string
): Promise<
  | { data: { interview_id: string; invited: boolean; starts_at: string } }
  | { error: string }
> {
  if (!SECRET) {
    return { error: "Booking is not configured." };
  }

  const parsed = recruitmentBookingConfirmSchema.safeParse({
    token,
    starts_at: startsAt,
  });
  if (!parsed.success) {
    return { error: "Invalid booking parameters." };
  }

  const { db, users } = await createAdminClient();
  const loaded = await loadToken(db, token);
  if ("error" in loaded) {
    return loaded;
  }
  const { record } = loaded;
  const panel = panelFromToken(record);

  const bookable = await loadBookableApplication(db, record, [
    "$id",
    "campus_id",
    "department_id",
    "campus.name",
    "department.$id",
    "slug",
    "translations.title",
    "translations.locale",
  ]);
  if ("error" in bookable) {
    return bookable;
  }
  const { application, job } = bookable;

  // The length comes from the token: the browser never decides it.
  const start = new Date(parsed.data.starts_at);
  const end = new Date(start.getTime() + record.duration_minutes * 60_000);
  const { slots } = await bookingSlots(record, panel);
  if (!slots.some((slot) => slot.getTime() === start.getTime())) {
    return { error: "That time is no longer available." };
  }

  const decrementClaim = () =>
    db
      .decrementRowColumn({
        databaseId: "app",
        tableId: "recruitment_booking_tokens",
        rowId: record.$id,
        column: "claim_lock",
        value: 1,
        min: 0,
      })
      .catch(() => undefined);

  // Atomically claim the token before any write. Two concurrent confirms both
  // pass the consumed_at read above; only the caller that increments the lock
  // from 0 to 1 may create an interview (PR-059).
  let claimHeld = false;
  try {
    const claimed = (await db.incrementRowColumn({
      databaseId: "app",
      tableId: "recruitment_booking_tokens",
      rowId: record.$id,
      column: "claim_lock",
      value: 1,
    })) as unknown as { claim_lock?: number };
    const lockValue =
      typeof claimed.claim_lock === "number" ? claimed.claim_lock : 0;
    if (lockValue !== 1) {
      // Lost the race — undo our own increment so the lock reflects only the
      // in-flight winner (0/1). Otherwise, if the winner later releases its
      // claim (slot overlap or a transient error), the leftover count keeps the
      // lock positive and every future attempt reports the link as already used.
      await decrementClaim();
      return { error: "This booking link has already been used." };
    }
    claimHeld = true;
  } catch (error) {
    // Schema without claim_lock yet — keep the legacy (racy) behaviour rather
    // than blocking all bookings.
    console.warn("[Booking] Atomic token claim unavailable:", error);
  }

  const releaseClaim = async () => {
    if (!claimHeld) {
      return;
    }
    await decrementClaim();
  };

  let interviewCreated = false;
  try {
    // Slot uniqueness: reject a slot that overlaps another SCHEDULED interview
    // for the same interviewer, so two candidates can't book the same instant
    // from different tokens (PR-060).
    if (record.created_by_user_id) {
      const overlapping = await db.listRows<JobInterviews>(
        "app",
        "job_interviews",
        [
          Query.equal("created_by_user_id", record.created_by_user_id),
          Query.equal("status", JobInterviewsStatus.SCHEDULED),
          Query.lessThan("starts_at", end.toISOString()),
          Query.greaterThan("ends_at", start.toISOString()),
          Query.limit(1),
        ]
      );
      if (overlapping.rows.length > 0) {
        await releaseClaim();
        return {
          error:
            "That time was just booked by someone else. Please pick another slot.",
        };
      }
    }

    const typedJob = job as unknown as {
      campus_id: string;
      department_id: string | null;
    };

    const interview = await createTypedRow<
      JobInterviews,
      JobInterviewWriteInput
    >(
      db,
      "app",
      "job_interviews",
      ID.unique(),
      {
        application: record.application_id,
        application_id: record.application_id,
        cancelled_reason: null,
        campus_id: typedJob.campus_id,
        created_by_user_id: record.created_by_user_id,
        department_id: typedJob.department_id ?? null,
        ends_at: end.toISOString(),
        job_id: application.job_id,
        location: "Teams",
        meeting_url: null,
        notes: "Booked by the candidate via their booking link.",
        outlook_event_id: null,
        round: 1,
        starts_at: start.toISOString(),
        status: JobInterviewsStatus.SCHEDULED,
        teams_meeting_id: null,
        timezone: TIMEZONE,
        title: `${application.applicant_name} — Round 1`,
      },
      buildRecruitmentStaffRowPermissions()
    );
    interviewCreated = true;

    // Participants make the interview visible to its panel (scorecards,
    // workspace) and tell the invite who to address.
    await createParticipant(db, interview.$id, {
      display_name: application.applicant_name,
      email: application.applicant_email,
      is_lead: false,
      role: JobInterviewParticipantsRole.CANDIDATE,
      user_id: null,
    });
    for (const member of panel) {
      await createParticipant(db, interview.$id, {
        display_name: member.display_name ?? null,
        email: member.email,
        is_lead: member.is_lead,
        role: JobInterviewParticipantsRole.INTERVIEWER,
        user_id: member.user_id,
      });
    }

    const { invited } = await inviteEveryone(
      db,
      interview,
      application.applicant_email,
      panel
    );
    if (!invited) {
      await alertInviteFailed(db, users, {
        candidateName: application.applicant_name,
        creatorUserId: record.created_by_user_id ?? null,
        interviewId: interview.$id,
        job,
        startsAt: start.toISOString(),
      });
    }

    await db.updateRow<RecruitmentBookingTokens>(
      "app",
      "recruitment_booking_tokens",
      record.$id,
      { consumed_at: new Date().toISOString(), interview_id: interview.$id }
    );

    return {
      data: {
        interview_id: interview.$id,
        invited,
        starts_at: start.toISOString(),
      },
    };
  } catch (error) {
    // Only release the claim when nothing was booked, so a transient failure
    // doesn't leave the candidate's link dead. Once the interview row exists
    // (e.g. the interview was created but marking the token consumed failed),
    // keep the claim held: releasing it would let the candidate book a SECOND
    // interview for the same application. That token is left for manual recovery.
    if (!interviewCreated) {
      await releaseClaim();
    }
    console.error("[Booking] Failed to confirm booking slot:", error);
    return { error: "Could not confirm the booking. Please try again." };
  }
}
