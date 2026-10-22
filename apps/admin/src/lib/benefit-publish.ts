import "server-only";
import { setBenefitStatus } from "@/app/(portal)/_actions/benefits";

/**
 * Publishes a benefit through `setBenefitStatus`, which authorizes on the
 * stored campus and rewrites permissions (published -> read("any")). A bare
 * session `updateRow` of `status` would leave the permissions stale.
 *
 * Kept as its own module so callers (assistant, approvals) can be tested
 * without process-wide mocking of the benefits actions module.
 */
export function publishBenefit(id: string) {
  return setBenefitStatus(id, "published");
}
