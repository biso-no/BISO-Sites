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
 * `job: Jobs`), but at write time we pass the ID string instead. These types
 * make that distinction explicit: ManyToOne fields become `string | null`,
 * reverse/computed relations are dropped entirely.
 */
type WriteInput<
  T,
  IdRels extends keyof T = never,
  Drop extends keyof T = never,
> = Omit<T, keyof Models.Row | IdRels | Drop> & {
  [K in IdRels]?: string | null;
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
