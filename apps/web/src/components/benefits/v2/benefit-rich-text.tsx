import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";

/**
 * A migrated benefit's HTML or Plate description, set at card size.
 *
 * Not `Prose`: that is the long-form measure. And the renderer wraps its
 * output in Tailwind Typography's `.prose`, a utility that beats the
 * components-layer `type-body-sm` and printed the description larger than the
 * card around it. The `[&_.prose]:` rules here outrank `.prose` on
 * specificity, so the card's size (`type-body-sm`: 0.875rem / 1.55), colour
 * and spacing hold whatever the layer order.
 */
export function BenefitRichText({ value }: { value: string }) {
  return (
    <div className="mt-2 [&_.prose]:text-ink-muted [&_.prose]:text-sm/[1.55] [&_a]:text-ink-accent [&_a]:underline [&_a]:underline-offset-4 [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:ps-5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_p]:my-2 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:my-2 [&_ul]:list-disc [&_ul]:ps-5">
      <PlateContentRenderer value={value} />
    </div>
  );
}
