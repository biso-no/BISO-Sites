interface PageHeaderProps {
  crumb?: string;
  description?: string;
  title: string;
  updated?: string | null;
  who?: string;
}

export function PageHeader({
  crumb,
  title,
  description,
  who,
  updated,
}: PageHeaderProps) {
  return (
    <header className="mb-8">
      {crumb ? <p className="mb-2 text-ink-muted text-sm">{crumb}</p> : null}
      <h1
        className="font-black font-display text-ink uppercase"
        style={{
          fontSize: "clamp(1.75rem, 3.5vw, 2.375rem)",
          lineHeight: 0.95,
        }}
      >
        {title}
      </h1>
      {description ? (
        <p className="mt-3 text-ink-muted text-lg">{description}</p>
      ) : null}
      {who || updated ? (
        <p className="mt-4 flex flex-wrap gap-x-4 text-ink-muted text-sm">
          {who ? <span>Who can do this: {who}</span> : null}
          {updated ? <span>Updated {updated}</span> : null}
        </p>
      ) : null}
    </header>
  );
}
