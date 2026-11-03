"use client";

import type { PlateEditor } from "platejs/react";
import type { MouseEvent, ReactNode } from "react";
import {
  runTableAction,
  type TableAction,
  type TableState,
  tableState,
} from "./table-commands";

/** Buttons take no focus, so the editor keeps its selection. */
const keepSelection = (event: MouseEvent) => event.preventDefault();

interface IconAction {
  action: TableAction;
  icon: ReactNode;
  label: string;
}

const ROW_ACTIONS: IconAction[] = [
  { action: "rowAbove", icon: <RowAboveIcon />, label: "Insert row above" },
  { action: "rowBelow", icon: <RowBelowIcon />, label: "Insert row below" },
  { action: "deleteRow", icon: <DeleteRowIcon />, label: "Delete row" },
];

const COLUMN_ACTIONS: IconAction[] = [
  {
    action: "columnLeft",
    icon: <ColumnLeftIcon />,
    label: "Insert column left",
  },
  {
    action: "columnRight",
    icon: <ColumnRightIcon />,
    label: "Insert column right",
  },
  {
    action: "deleteColumn",
    icon: <DeleteColumnIcon />,
    label: "Delete column",
  },
];

/**
 * The table controls, a line of their own under the formatting buttons while
 * the caret is in a table: rows, columns, the header row and the table
 * itself. Each line part (`Row`, `Column`, the text buttons) stays whole when
 * the line wraps. The text buttons are set apart by a margin, not a rule,
 * which the panel's width would leave at the end of a line. A command that
 * takes the table away hands focus back to the text, since the button
 * pressed goes with it.
 */
export function TableBar({
  editor,
  state,
}: {
  editor: PlateEditor;
  state: TableState;
}) {
  const run = (action: TableAction) => () => {
    runTableAction(editor, action);
    if (tableState(editor) === null) {
      editor.tf.focus();
    }
  };
  const iconButton = ({ action, icon, label }: IconAction) => (
    <button
      aria-label={label}
      className="pe-rt-btn"
      disabled={action === "rowAbove" && state.inHeaderRow}
      key={action}
      onClick={run(action)}
      onMouseDown={keepSelection}
      title={label}
      type="button"
    >
      {icon}
    </button>
  );

  return (
    // A labelled group of toolbar buttons inside the toolbar.
    // biome-ignore lint/a11y/useSemanticElements: a fieldset is for form fields and brings its own box.
    <div aria-label="Table" className="pe-rt-table" role="group">
      <span className="pe-rt-group">
        <span aria-hidden="true" className="pe-rt-table__label">
          Row
        </span>
        {ROW_ACTIONS.map(iconButton)}
      </span>
      <span aria-hidden="true" className="pe-rt-sep" />
      <span className="pe-rt-group">
        <span aria-hidden="true" className="pe-rt-table__label">
          Column
        </span>
        {COLUMN_ACTIONS.map(iconButton)}
      </span>
      <span className="pe-rt-group pe-rt-table__text">
        <button
          aria-label="Header row"
          aria-pressed={state.headerRow}
          className="pe-rt-btn pe-rt-table__btn"
          onClick={run("toggleHeader")}
          onMouseDown={keepSelection}
          title="Header row"
          type="button"
        >
          Header row
        </button>
        <button
          aria-label="Delete table"
          className="pe-rt-btn pe-rt-table__btn"
          onClick={run("deleteTable")}
          onMouseDown={keepSelection}
          title="Delete table"
          type="button"
        >
          Delete table
        </button>
      </span>
    </div>
  );
}

/** A 13px line icon in the toolbar's own stroke. */
function BarIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="13"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="13"
    >
      {children}
    </svg>
  );
}

function RowAboveIcon() {
  return (
    <BarIcon>
      <rect height="8" rx="1.5" width="18" x="3" y="13" />
      <path d="M12 3v7M8.5 6.5h7" />
    </BarIcon>
  );
}

function RowBelowIcon() {
  return (
    <BarIcon>
      <rect height="8" rx="1.5" width="18" x="3" y="3" />
      <path d="M12 14v7M8.5 17.5h7" />
    </BarIcon>
  );
}

function DeleteRowIcon() {
  return (
    <BarIcon>
      <rect height="10" rx="1.5" width="18" x="3" y="7" />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
    </BarIcon>
  );
}

function ColumnLeftIcon() {
  return (
    <BarIcon>
      <rect height="18" rx="1.5" width="8" x="13" y="3" />
      <path d="M3 12h7M6.5 8.5v7" />
    </BarIcon>
  );
}

function ColumnRightIcon() {
  return (
    <BarIcon>
      <rect height="18" rx="1.5" width="8" x="3" y="3" />
      <path d="M14 12h7M17.5 8.5v7" />
    </BarIcon>
  );
}

function DeleteColumnIcon() {
  return (
    <BarIcon>
      <rect height="18" rx="1.5" width="10" x="7" y="3" />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
    </BarIcon>
  );
}
