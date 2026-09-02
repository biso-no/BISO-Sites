import type { ReactNode } from "react";

/**
 * Renders one privacy section's body.
 *
 * The source text is plain prose with two conventions it already used:
 * paragraphs separated by a blank line, `**bold**` for emphasis, and lines
 * starting with a bullet character for list items. The previous page honoured
 * only the first two — bullets stayed literal `•` characters inside a
 * `whitespace-pre-line` paragraph, so a screen reader announced a run-on
 * sentence rather than a list of five items, and the indent came from a glyph
 * rather than from layout.
 *
 * No word is changed: this only gives the existing punctuation real structure.
 */

const BULLET = "•";

function withEmphasis(text: string, keyPrefix: string): ReactNode[] {
  // Odd-indexed runs sit between a pair of `**` markers.
  return text
    .split("**")
    .map((part, index) =>
      index % 2 === 1 ? (
        <strong key={`${keyPrefix}-${index}`}>{part}</strong>
      ) : (
        <span key={`${keyPrefix}-${index}`}>{part}</span>
      )
    );
}

export function PrivacyContent({
  content,
  id,
}: {
  content: string;
  id: string;
}) {
  const paragraphs = content.split("\n\n");

  return (
    <>
      {paragraphs.map((paragraph, paragraphIndex) => {
        const lines = paragraph.split("\n");
        const bullets = lines.filter((line) => line.startsWith(BULLET));
        const lead = lines.filter((line) => !line.startsWith(BULLET));
        const key = `${id}-${paragraphIndex}`;

        return (
          <div key={key}>
            {lead.length > 0 && lead.join("").trim().length > 0 ? (
              <p className="whitespace-pre-line">
                {withEmphasis(lead.join("\n"), `${key}-p`)}
              </p>
            ) : null}
            {bullets.length > 0 ? (
              <ul>
                {bullets.map((line, lineIndex) => (
                  <li key={`${key}-li-${lineIndex}`}>
                    {withEmphasis(
                      line.slice(BULLET.length).trim(),
                      `${key}-li-${lineIndex}`
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
