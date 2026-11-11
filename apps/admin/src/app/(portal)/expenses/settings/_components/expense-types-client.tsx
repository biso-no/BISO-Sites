"use client";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@repo/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { type CSSProperties, useState, useTransition } from "react";
import { toast } from "sonner";
import { STUDIO, studioSurface } from "../../../_components/studio";
import {
  getExpenseTypesView,
  saveExpenseType,
  seedStartingExpenseTypes,
  syncExpenseAccounts,
} from "../actions";
import type { ExpenseAccountOption, ExpenseTypeView } from "../types-model";

export interface ExpenseTypesLabels {
  account: string;
  active: string;
  addType: string;
  aiNote: string;
  askOccasion: string;
  chooseAccount: string;
  loadStarting: string;
  name: string;
  nameNo: string;
  noAccountFound: string;
  noTypes: string;
  save: string;
  saved: string;
  searchAccount: string;
  /** Contains `{created}` and `{skipped}`. */
  seeded: string;
  sortOrder: string;
  syncAccounts: string;
  /** Contains `{count}`. */
  syncDone: string;
  syncError: string;
  /** Contains `{count}` and `{failed}`. */
  syncPartial: string;
  typesHint: string;
}

type View = Awaited<ReturnType<typeof getExpenseTypesView>>;

const inputStyle: CSSProperties = {
  background: STUDIO.white,
  border: `0.5px solid ${STUDIO.rule2}`,
  borderRadius: 8,
  color: STUDIO.ink,
  fontSize: 13,
  padding: "6px 10px",
  width: "100%",
};

const buttonStyleFor = (primary: boolean): CSSProperties => ({
  background: primary ? STUDIO.ink : STUDIO.white,
  border: `0.5px solid ${STUDIO.rule2}`,
  borderRadius: 8,
  color: primary ? STUDIO.white : STUDIO.ink,
  fontSize: 13,
  fontWeight: 500,
  padding: "6px 14px",
});

interface Draft {
  accountNumber: number | null;
  active: boolean;
  askOccasion: boolean;
  description: string;
  label: string;
  labelNo: string;
  sortOrder: string;
}

function toDraft(type: ExpenseTypeView | null, nextSort: number): Draft {
  return {
    accountNumber: type?.accountNumber ?? null,
    active: type?.active ?? true,
    askOccasion: type?.askOccasion ?? false,
    description: type?.description ?? "",
    label: type?.label ?? "",
    labelNo: type?.labelNo ?? "",
    sortOrder: String(type?.sortOrder ?? nextSort),
  };
}

function AccountPicker({
  accounts,
  labels,
  onChange,
  value,
}: {
  accounts: ExpenseAccountOption[];
  labels: ExpenseTypesLabels;
  onChange: (accountNumber: number) => void;
  value: number | null;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((option) => option.accountNumber === value);
  const text = selected
    ? `${selected.accountNumber} ${selected.name}`
    : (value?.toString() ?? labels.chooseAccount);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={labels.account}
          style={{ ...inputStyle, textAlign: "left" }}
          type="button"
        >
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput placeholder={labels.searchAccount} />
          <CommandList>
            <CommandEmpty>{labels.noAccountFound}</CommandEmpty>
            {accounts.map((option) => (
              <CommandItem
                key={option.accountNumber}
                onSelect={() => {
                  onChange(option.accountNumber);
                  setOpen(false);
                }}
                value={`${option.accountNumber} ${option.name}`}
              >
                {option.accountNumber} {option.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TypeRow({
  accounts,
  labels,
  nextSort,
  onSave,
  pending,
  type,
}: {
  accounts: ExpenseAccountOption[];
  labels: ExpenseTypesLabels;
  nextSort: number;
  onSave: (id: string | null, draft: Draft) => Promise<boolean>;
  pending: boolean;
  type: ExpenseTypeView | null;
}) {
  const [draft, setDraft] = useState(() => toDraft(type, nextSort));
  const rowId = type?.$id ?? "new";

  return (
    <tr style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}>
      <td className="py-2 pr-2 align-top">
        <input
          aria-label={labels.name}
          onChange={(event) =>
            setDraft({ ...draft, label: event.target.value })
          }
          style={inputStyle}
          value={draft.label}
        />
      </td>
      <td className="py-2 pr-2 align-top">
        <input
          aria-label={labels.nameNo}
          onChange={(event) =>
            setDraft({ ...draft, labelNo: event.target.value })
          }
          style={inputStyle}
          value={draft.labelNo}
        />
      </td>
      <td className="py-2 pr-2 align-top">
        <AccountPicker
          accounts={accounts}
          labels={labels}
          onChange={(accountNumber) => setDraft({ ...draft, accountNumber })}
          value={draft.accountNumber}
        />
      </td>
      <td className="py-2 pr-2 align-top">
        <input
          aria-label={labels.aiNote}
          onChange={(event) =>
            setDraft({ ...draft, description: event.target.value })
          }
          style={inputStyle}
          value={draft.description}
        />
      </td>
      <td className="py-2 pr-2 text-center align-top">
        <input
          aria-label={labels.askOccasion}
          checked={draft.askOccasion}
          id={`occasion-${rowId}`}
          onChange={(event) =>
            setDraft({ ...draft, askOccasion: event.target.checked })
          }
          type="checkbox"
        />
      </td>
      <td className="py-2 pr-2 text-center align-top">
        <input
          aria-label={labels.active}
          checked={draft.active}
          id={`active-${rowId}`}
          onChange={(event) =>
            setDraft({ ...draft, active: event.target.checked })
          }
          type="checkbox"
        />
      </td>
      <td className="py-2 pr-2 align-top">
        <input
          aria-label={labels.sortOrder}
          inputMode="numeric"
          onChange={(event) =>
            setDraft({ ...draft, sortOrder: event.target.value })
          }
          style={{ ...inputStyle, width: 64 }}
          value={draft.sortOrder}
        />
      </td>
      <td className="py-2 text-right align-top">
        <button
          disabled={pending}
          onClick={async () => {
            const ok = await onSave(type?.$id ?? null, draft);
            if (ok && !type) {
              setDraft(toDraft(null, nextSort + 1));
            }
          }}
          style={buttonStyleFor(!type)}
          type="button"
        >
          {type ? labels.save : labels.addType}
        </button>
      </td>
    </tr>
  );
}

export function ExpenseTypesClient({
  initialView,
  labels,
}: {
  initialView: View;
  labels: ExpenseTypesLabels;
}) {
  const [view, setView] = useState(initialView);
  const [pending, startTransition] = useTransition();

  const reload = async () => {
    setView(await getExpenseTypesView());
  };

  const nextSort = (view.types.at(-1)?.sortOrder ?? -1) + 1;

  // Runs inside the transition so `pending` disables every button until the
  // save and reload finish; a double click cannot create the row twice.
  const handleSave = (id: string | null, draft: Draft): Promise<boolean> =>
    new Promise((resolve) => {
      startTransition(async () => {
        if (draft.accountNumber === null) {
          toast.error(labels.chooseAccount);
          resolve(false);
          return;
        }
        const result = await saveExpenseType(id, {
          accountNumber: draft.accountNumber,
          active: draft.active,
          askOccasion: draft.askOccasion,
          description: draft.description,
          label: draft.label,
          labelNo: draft.labelNo,
          sortOrder: Number(draft.sortOrder),
        });
        if ("error" in result) {
          toast.error(result.error);
          resolve(false);
          return;
        }
        toast.success(labels.saved);
        await reload();
        resolve(true);
      });
    });

  const handleSeed = () =>
    startTransition(async () => {
      const result = await seedStartingExpenseTypes();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        labels.seeded
          .replace("{created}", String(result.data.created))
          .replace("{skipped}", String(result.data.skipped))
      );
      await reload();
    });

  const handleSync = () =>
    startTransition(async () => {
      const result = await syncExpenseAccounts();
      if ("error" in result) {
        toast.error(result.error || labels.syncError);
        return;
      }
      const { failed, succeeded } = result.data;
      const message = failed > 0 ? labels.syncPartial : labels.syncDone;
      toast.success(
        message
          .replace("{count}", String(succeeded))
          .replace("{failed}", String(failed))
      );
      await reload();
    });

  return (
    <section className="mt-6 rounded-2xl p-5" style={studioSurface}>
      <p className="text-[13px]" style={{ color: STUDIO.ink4 }}>
        {labels.typesHint}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {view.tableEmpty && (
          <>
            <span className="text-[13px]" style={{ color: STUDIO.ink4 }}>
              {labels.noTypes}
            </span>
            <button
              disabled={pending}
              onClick={handleSeed}
              style={buttonStyleFor(true)}
              type="button"
            >
              {labels.loadStarting}
            </button>
          </>
        )}
        <button
          disabled={pending}
          onClick={handleSync}
          style={buttonStyleFor(false)}
          type="button"
        >
          {labels.syncAccounts}
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[12px]" style={{ color: STUDIO.ink4 }}>
              <th className="pb-2 font-normal">{labels.name}</th>
              <th className="pb-2 font-normal">{labels.nameNo}</th>
              <th className="pb-2 font-normal">{labels.account}</th>
              <th className="pb-2 font-normal">{labels.aiNote}</th>
              <th className="pb-2 text-center font-normal">
                {labels.askOccasion}
              </th>
              <th className="pb-2 text-center font-normal">{labels.active}</th>
              <th className="pb-2 font-normal">{labels.sortOrder}</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {view.types.map((type) => (
              <TypeRow
                accounts={view.accounts}
                key={`${type.$id}-${type.accountNumber}-${type.label}-${type.sortOrder}-${type.active}`}
                labels={labels}
                nextSort={nextSort}
                onSave={handleSave}
                pending={pending}
                type={type}
              />
            ))}
            <TypeRow
              accounts={view.accounts}
              key={`new-${view.types.length}`}
              labels={labels}
              nextSort={nextSort}
              onSave={handleSave}
              pending={pending}
              type={null}
            />
          </tbody>
        </table>
      </div>
    </section>
  );
}
