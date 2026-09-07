/** Appwrite bucket + file holding the recorded recruitment walkthrough. */
export const RECRUITMENT_GUIDE_BUCKET_ID = "admin";
export const RECRUITMENT_GUIDE_FILE_ID = "recruitment-portal-guide";

/**
 * Where players should load the walkthrough from: this app's own proxy, not the
 * Appwrite Storage URL. The file is team-scoped and the browser holds no
 * Appwrite-visible session, so a direct Storage URL answers 401 to a `<video>`
 * element. See `app/api/recruitment/guide-video/route.ts`.
 *
 * Used by the closing step of the HR tour and the dashboard's guide button, so
 * both entry points always play the same file.
 */
export const RECRUITMENT_GUIDE_VIDEO_URL = "/api/recruitment/guide-video";
