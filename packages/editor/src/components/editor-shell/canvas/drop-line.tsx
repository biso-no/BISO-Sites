/** The accent line that marks where a drop will land. */
export function DropLine({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: 2,
        margin: "1px 0",
        borderRadius: 999,
        flexShrink: 0,
        background: "var(--page-accent)",
        boxShadow: active
          ? "0 0 0 4px color-mix(in srgb, var(--page-accent) 18%, transparent)"
          : "none",
        opacity: active ? 1 : 0,
        transition: "opacity .12s, box-shadow .12s",
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * A zero-height slot that draws a `DropLine` on a boundary. It takes no room,
 * so starting a drag never shifts the page under the pointer.
 */
export function DropSlot({ active }: { active: boolean }) {
  return (
    <div aria-hidden="true" className="pe-drop-slot">
      <DropLine active={active} />
    </div>
  );
}
