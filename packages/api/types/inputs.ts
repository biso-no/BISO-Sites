import type { Models } from "../index";
import type {
  CandidateProfiles,
  JobApplicationAnswers,
  JobApplications,
  JobInterviewParticipants,
  JobInterviewScorecards,
  JobInterviews,
  Jobs,
} from "./appwrite";

/**
 * Write-side input types for tables with Appwrite relationship columns.
 *
 * Appwrite row types carry relationship fields as the related object (e.g.
 * `job: Jobs`), but at write time Appwrite accepts either the related object or
 * just its ID string. These types make that explicit: ManyToOne fields (IdRels)
 * become `string | RelatedRow | null` and optional, reverse/computed relations
 * (Drop) are removed, and system (`Models.Row`) fields are stripped.
 */
type WriteInput<
  T,
  IdRels extends keyof T = never,
  Drop extends keyof T = never,
> = Omit<T, keyof Models.Row | IdRels | Drop> & {
  [K in IdRels]?: string | T[K] | null;
};

export type JobWriteInput = WriteInput<
  Jobs,
  "campus" | "department",
  "translations" | "applications"
>;

export type JobApplicationWriteInput = WriteInput<
  JobApplications,
  "job" | "candidate_profile",
  "answers" | "interviews"
>;

export type JobApplicationAnswerWriteInput = WriteInput<
  JobApplicationAnswers,
  "application"
>;

export type JobInterviewWriteInput = WriteInput<
  JobInterviews,
  "application",
  "participants" | "scorecards"
>;

export type JobInterviewParticipantWriteInput = WriteInput<
  JobInterviewParticipants,
  "interview"
>;

export type JobInterviewScorecardWriteInput = WriteInput<
  JobInterviewScorecards,
  "interview"
>;

export type CandidateProfileWriteInput = WriteInput<
  CandidateProfiles,
  never,
  "applications"
>;
