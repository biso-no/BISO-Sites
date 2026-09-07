import type { WpJob, WpJobPost } from "../extract/index";
import { CAMPUS_IDS, type ContentLocale, type RejectRow } from "../types";
import {
  AUTO_ACCEPT_CONFIDENCE,
  type DepartmentRecord,
  matchDepartment,
} from "./departments";
import {
  decodeEntities,
  normalizeDescriptionHtml,
  plainTextExcerpt,
} from "./html";
import { detectLocale } from "./locale";
import { buildTimestampOverrides } from "./timestamps";

const MAX_METADATA_TAGS = 4;
const MAX_TAG_LENGTH = 40;
const MAX_METADATA_JSON_LENGTH = 2000;

interface JobMetadata {
  auto_screen: true;
  auto_translate: false;
  company: null;
  employment_type: string | null;
  location: string | null;
  tags: string[];
}

/**
 * Defensive cap so an unusually long free-text `employment_type`/`location`
 * value can never fail the whole load with a jobs.metadata (size 2000)
 * validation error. Tags are dropped first — they're already the most
 * disposable part of metadata (capped at MAX_METADATA_TAGS short strings)
 * and losing them beats a load run dying mid-way on one row.
 */
function buildMetadataJson(metadata: JobMetadata): string {
  const json = JSON.stringify(metadata);
  if (json.length <= MAX_METADATA_JSON_LENGTH) {
    return json;
  }
  return JSON.stringify({ ...metadata, tags: [] });
}

export interface TransformedJob {
  departmentConfidence: number;
  departmentName: string | null;
  descriptionHtml: string;
  row: Record<string, unknown>;
  rowId: string;
  shortDescription: string;
  sourceLocale: ContentLocale;
  title: string;
}

/** Key used in the reviewed department mapping: campusId + raw WP name. */
export function departmentMappingKey(campusId: string, wpName: string): string {
  return `${campusId}::${wpName}`;
}

function resolveJobDepartment(
  departmentName: string | null,
  campusId: string,
  departments: DepartmentRecord[],
  resolvedDepartments: Map<string, string>
): {
  departmentConfidence: number;
  departmentId: string | null;
  warning: string | null;
} {
  if (!departmentName) {
    return { departmentConfidence: 0, departmentId: null, warning: null };
  }

  const resolved = resolvedDepartments.get(
    departmentMappingKey(campusId, departmentName)
  );
  if (resolved) {
    return { departmentConfidence: 1, departmentId: resolved, warning: null };
  }

  const match = matchDepartment(departmentName, campusId, departments);
  const departmentId =
    match.confidence >= AUTO_ACCEPT_CONFIDENCE ? match.departmentId : null;
  const warning = departmentId
    ? null
    : `department "${departmentName}" unresolved (confidence ${match.confidence.toFixed(2)})`;

  return { departmentConfidence: match.confidence, departmentId, warning };
}

export function transformJob(
  input: WpJob & { post: WpJobPost },
  departments: DepartmentRecord[],
  resolvedDepartments: Map<string, string>
): {
  job: TransformedJob | null;
  reject: RejectRow | null;
  warnings: string[];
} {
  const warnings: string[] = [];
  const title = decodeEntities(
    input.title || input.post.title.rendered || ""
  ).trim();
  const label = title || input.slug;

  const campusName = input.campus[0];
  const campusId = campusName ? CAMPUS_IDS[campusName] : undefined;
  if (!campusId) {
    return {
      job: null,
      reject: {
        label,
        reason: `No resolvable campus (${JSON.stringify(input.campus)}); jobs.campus_id is required`,
        sourceId: input.id,
      },
      warnings,
    };
  }

  if (!title) {
    return {
      job: null,
      reject: {
        label: input.slug,
        reason: "No job title; content_translations.title is required",
        sourceId: input.id,
      },
      warnings,
    };
  }

  const departmentName = input.department[0] ?? null;
  const departmentResolution = resolveJobDepartment(
    departmentName,
    campusId,
    departments,
    resolvedDepartments
  );
  const { departmentId, departmentConfidence } = departmentResolution;
  if (departmentResolution.warning) {
    warnings.push(`Job ${input.id}: ${departmentResolution.warning}`);
  }

  // The /custom/v1/jobs `content` field is plain text with blank-line breaks;
  // the wp/v2 post carries Gutenberg HTML. Prefer the richer HTML source.
  const sourceHtml = input.post.content.rendered || input.content || "";
  const description = normalizeDescriptionHtml(sourceHtml);
  if (description.truncated) {
    warnings.push(`Job ${input.id} description truncated to 8000 chars`);
  }

  // Detect from the body, not the URL: Polylang locale is unreliable, and an
  // English job title on a Norwegian body is common.
  const detection = detectLocale(
    `${title} ${plainTextExcerpt(sourceHtml, 2000)}`
  );
  if (detection.confidence < 0.6) {
    warnings.push(
      `Job ${input.id}: low language-detection confidence (${detection.confidence.toFixed(2)}), assumed ${detection.locale}`
    );
  }

  const status = input.is_expired ? "closed" : "published";
  const tags = input.verv
    .map((verv) => verv.trim())
    .filter((verv) => verv.length > 0 && verv.length <= MAX_TAG_LENGTH)
    .slice(0, MAX_METADATA_TAGS);

  const metadata: JobMetadata = {
    auto_screen: true,
    auto_translate: false,
    company: null,
    employment_type: input.job_type,
    location: input.location,
    tags,
  };

  const row: Record<string, unknown> = {
    // Backdated to the WordPress publish/modify dates so the archive
    // sorts correctly in every `$createdAt`-ordered job list.
    ...buildTimestampOverrides(input.post.date_gmt, input.post.modified_gmt),
    application_deadline: input.expiry_date
      ? new Date(`${input.expiry_date}T00:00:00.000Z`).toISOString()
      : null,
    auto_screen: true,
    campus: campusId,
    campus_id: campusId,
    department: departmentId,
    department_id: departmentId,
    metadata: buildMetadataJson(metadata),
    slug: input.slug,
    status,
  };

  return {
    job: {
      departmentConfidence,
      departmentName,
      descriptionHtml: description.html,
      row,
      rowId: `wpjob${input.id}`,
      shortDescription: plainTextExcerpt(sourceHtml, 500),
      sourceLocale: detection.locale,
      title,
    },
    reject: null,
    warnings,
  };
}
