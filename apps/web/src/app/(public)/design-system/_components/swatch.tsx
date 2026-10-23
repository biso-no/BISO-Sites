/**
 * A single token, showing its name, its authored value, and — resolved in the
 * browser — the value the page actually computes. The computed column is what
 * makes this page a verification surface rather than a picture of one: if a
 * token stops resolving, the cell reads "unresolved" instead of quietly
 * inheriting something plausible.
 */
export function Swatch({
  token,
  note,
  onDeep = false,
}: {
  token: string;
  note?: string;
  onDeep?: boolean;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`size-11 shrink-0 rounded-biso-sm border ${
          onDeep ? "border-white/20" : "border-edge"
        }`}
        style={{ background: `var(${token})` }}
      />
      <span className="min-w-0">
        <code className="type-data block truncate">{token}</code>
        <span
          className="type-body-sm block text-ink-muted"
          data-computed-for={token}
        >
          …
        </span>
        {note ? (
          <span className="type-body-sm block text-ink-muted italic">
            {note}
          </span>
        ) : null}
      </span>
    </li>
  );
}
