"use client";

import {
  type CSSProperties,
  type ReactNode,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { STUDIO, studioSurface } from "../../../_components/studio";
import { type LedgerAccountOption, vatKind } from "../accounting-model";
import {
  type AccountingView,
  getAccountingView,
  type SalesTypeView,
  saveSalesType,
  saveShopAccountingSettings,
  seedDefaultSalesTypes,
  setShopLedgerPosting,
  syncLedgerAccountsFromFinago,
} from "../actions";

export interface AccountingLabels {
  account: string;
  active: string;
  addSalesType: string;
  chooseAccount: string;
  createDefaults: string;
  labelEn: string;
  labelNo: string;
  /** Contains `{time}`. */
  lastSynced: string;
  neverSynced: string;
  noSalesTypes: string;
  notSaved: string;
  postingHint: string;
  postingOff: string;
  postingOn: string;
  postingTitle: string;
  salesTypesHint: string;
  salesTypesTitle: string;
  save: string;
  saved: string;
  saveError: string;
  settingsHint: string;
  settingsTitle: string;
  sortOrder: string;
  stripeClearing: string;
  switchOff: string;
  switchOn: string;
  syncButton: string;
  syncDone: string;
  syncTitle: string;
  vat: string;
  vatExempt: string;
  vatNone: string;
  /** Contains `{code}`. */
  vatOther: string;
  vatStandard: string;
  vatUnknown: string;
  vippsClearing: string;
  voucherType: string;
}

const inputStyle: CSSProperties = {
  background: STUDIO.white,
  border: `0.5px solid ${STUDIO.rule2}`,
  borderRadius: 8,
  color: STUDIO.ink,
  fontSize: 13,
  padding: "6px 10px",
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

function vatLabel(vatCode: number | null, labels: AccountingLabels): string {
  switch (vatKind(vatCode)) {
    case "standard":
      return labels.vatStandard;
    case "exempt":
      return labels.vatExempt;
    case "none":
      return labels.vatNone;
    case "other":
      return labels.vatOther.replace("{code}", String(vatCode));
    default:
      return labels.vatUnknown;
  }
}

function Panel({
  children,
  hint,
  title,
}: {
  children: ReactNode;
  hint?: string;
  title: string;
}) {
  return (
    <section className="mb-6 rounded-2xl p-5" style={studioSurface}>
      <h2 className="font-medium text-[15px]" style={{ color: STUDIO.ink }}>
        {title}
      </h2>
      {hint && (
        <p className="mt-1 text-[13px]" style={{ color: STUDIO.ink4 }}>
          {hint}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PostingPanel({
  enabled,
  labels,
  onToggle,
  pending,
}: {
  enabled: boolean;
  labels: AccountingLabels;
  onToggle: (enabled: boolean) => void;
  pending: boolean;
}) {
  return (
    <Panel hint={labels.postingHint} title={labels.postingTitle}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span
          className="inline-flex items-center gap-2 text-sm"
          style={{ color: enabled ? STUDIO.leaf : STUDIO.ink4 }}
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{ background: enabled ? STUDIO.leaf : STUDIO.ink4 }}
          />
          {enabled ? labels.postingOn : labels.postingOff}
        </span>
        <button
          disabled={pending}
          onClick={() => onToggle(!enabled)}
          style={buttonStyleFor(!enabled)}
          type="button"
        >
          {enabled ? labels.switchOff : labels.switchOn}
        </button>
      </div>
    </Panel>
  );
}

function SettingsPanel({
  labels,
  onSave,
  pending,
  saved,
  settings,
}: {
  labels: AccountingLabels;
  onSave: (values: {
    stripe: string;
    transactionType: string;
    vipps: string;
  }) => void;
  pending: boolean;
  saved: boolean;
  settings: AccountingView["settings"];
}) {
  const [transactionType, setTransactionType] = useState(
    String(settings.transactionTypeNumber)
  );
  const [vipps, setVipps] = useState(String(settings.clearingAccounts.vipps));
  const [stripe, setStripe] = useState(
    String(settings.clearingAccounts.stripe)
  );

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void
  ) => (
    <label className="flex flex-col gap-1 text-[13px]" htmlFor={id}>
      <span style={{ color: STUDIO.ink2 }}>{label}</span>
      <input
        id={id}
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
        value={value}
      />
    </label>
  );

  return (
    <Panel hint={labels.settingsHint} title={labels.settingsTitle}>
      {!saved && (
        <p className="mb-3 text-[13px]" style={{ color: STUDIO.ink4 }}>
          {labels.notSaved}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {field(
          "voucher-type",
          labels.voucherType,
          transactionType,
          setTransactionType
        )}
        {field("vipps-clearing", labels.vippsClearing, vipps, setVipps)}
        {field("stripe-clearing", labels.stripeClearing, stripe, setStripe)}
      </div>
      <div className="mt-4">
        <button
          disabled={pending}
          onClick={() => onSave({ stripe, transactionType, vipps })}
          style={buttonStyleFor(true)}
          type="button"
        >
          {labels.save}
        </button>
      </div>
    </Panel>
  );
}

interface SalesTypeDraft {
  accountNumber: string;
  active: boolean;
  labelEn: string;
  labelNo: string;
  sortOrder: string;
}

function toDraft(type: SalesTypeView | null, nextSort: number): SalesTypeDraft {
  return {
    accountNumber: type ? String(type.accountNumber) : "",
    active: type?.active ?? true,
    labelEn: type?.labelEn ?? "",
    labelNo: type?.labelNo ?? "",
    sortOrder: String(type?.sortOrder ?? nextSort),
  };
}

function SalesTypeRow({
  accounts,
  labels,
  nextSort,
  onSave,
  pending,
  type,
}: {
  accounts: LedgerAccountOption[];
  labels: AccountingLabels;
  nextSort: number;
  onSave: (id: string | null, draft: SalesTypeDraft) => Promise<boolean>;
  pending: boolean;
  type: SalesTypeView | null;
}) {
  const [draft, setDraft] = useState(() => toDraft(type, nextSort));
  const account = accounts.find(
    (option) => String(option.accountNumber) === draft.accountNumber
  );
  const rowId = type?.$id ?? "new";

  return (
    <tr style={{ borderTop: `0.5px solid ${STUDIO.rule}` }}>
      <td className="py-2 pr-2">
        <input
          aria-label={labels.labelNo}
          onChange={(event) =>
            setDraft({ ...draft, labelNo: event.target.value })
          }
          style={{ ...inputStyle, width: "100%" }}
          value={draft.labelNo}
        />
      </td>
      <td className="py-2 pr-2">
        <input
          aria-label={labels.labelEn}
          onChange={(event) =>
            setDraft({ ...draft, labelEn: event.target.value })
          }
          style={{ ...inputStyle, width: "100%" }}
          value={draft.labelEn}
        />
      </td>
      <td className="py-2 pr-2">
        <select
          aria-label={labels.account}
          onChange={(event) =>
            setDraft({ ...draft, accountNumber: event.target.value })
          }
          style={{ ...inputStyle, width: "100%" }}
          value={draft.accountNumber}
        >
          <option value="">{labels.chooseAccount}</option>
          {accounts.map((option) => (
            <option key={option.accountNumber} value={option.accountNumber}>
              {option.accountNumber} {option.name}
            </option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-2 text-[13px]" style={{ color: STUDIO.ink2 }}>
        {vatLabel(account?.vatCode ?? null, labels)}
      </td>
      <td className="py-2 pr-2 text-center">
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
      <td className="py-2 pr-2">
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
      <td className="py-2 text-right">
        <button
          disabled={pending}
          onClick={async () => {
            const ok = await onSave(type?.$id ?? null, draft);
            if (ok && !type) {
              setDraft(toDraft(null, nextSort + 10));
            }
          }}
          style={buttonStyleFor(!type)}
          type="button"
        >
          {type ? labels.save : labels.addSalesType}
        </button>
      </td>
    </tr>
  );
}

export function AccountingClient({
  initialView,
  labels,
}: {
  initialView: AccountingView;
  labels: AccountingLabels;
}) {
  const [view, setView] = useState(initialView);
  const [pending, startTransition] = useTransition();

  const reload = async () => {
    setView(await getAccountingView());
  };

  const run = (work: () => Promise<void>) => {
    startTransition(async () => {
      await work();
    });
  };

  const nextSort = (view.salesTypes.at(-1)?.sortOrder ?? 0) + 10;

  const handleSaveSalesType = async (
    id: string | null,
    draft: SalesTypeDraft
  ): Promise<boolean> => {
    const result = await saveSalesType(id, {
      account_number: Number(draft.accountNumber),
      active: draft.active,
      label_en: draft.labelEn,
      label_no: draft.labelNo,
      sort_order: Number(draft.sortOrder),
    });
    if ("error" in result) {
      toast.error(result.error);
      return false;
    }
    toast.success(labels.saved);
    await reload();
    return true;
  };

  return (
    <div className="mt-6">
      <PostingPanel
        enabled={view.postingEnabled}
        labels={labels}
        onToggle={(enabled) =>
          run(async () => {
            const result = await setShopLedgerPosting(enabled);
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            toast.success(labels.saved);
            await reload();
          })
        }
        pending={pending}
      />

      <SettingsPanel
        labels={labels}
        onSave={(values) =>
          run(async () => {
            const result = await saveShopAccountingSettings({
              clearingAccounts: {
                stripe: Number(values.stripe),
                vipps: Number(values.vipps),
              },
              transactionTypeNumber: Number(values.transactionType),
            });
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            toast.success(labels.saved);
            await reload();
          })
        }
        pending={pending}
        saved={view.settingsSaved}
        settings={view.settings}
      />

      <Panel hint={labels.salesTypesHint} title={labels.salesTypesTitle}>
        {view.salesTypes.length === 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-[13px]" style={{ color: STUDIO.ink4 }}>
              {labels.noSalesTypes}
            </span>
            <button
              disabled={pending}
              onClick={() =>
                run(async () => {
                  const result = await seedDefaultSalesTypes();
                  if ("error" in result) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success(labels.saved);
                  await reload();
                })
              }
              style={buttonStyleFor(true)}
              type="button"
            >
              {labels.createDefaults}
            </button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[12px]" style={{ color: STUDIO.ink4 }}>
                <th className="pb-2 font-normal">{labels.labelNo}</th>
                <th className="pb-2 font-normal">{labels.labelEn}</th>
                <th className="pb-2 font-normal">{labels.account}</th>
                <th className="pb-2 font-normal">{labels.vat}</th>
                <th className="pb-2 font-normal">{labels.active}</th>
                <th className="pb-2 font-normal">{labels.sortOrder}</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {view.salesTypes.map((type) => (
                <SalesTypeRow
                  accounts={view.accounts}
                  key={`${type.$id}-${type.accountNumber}-${type.sortOrder}`}
                  labels={labels}
                  nextSort={nextSort}
                  onSave={handleSaveSalesType}
                  pending={pending}
                  type={type}
                />
              ))}
              <SalesTypeRow
                accounts={view.accounts}
                key={`new-${view.salesTypes.length}`}
                labels={labels}
                nextSort={nextSort}
                onSave={handleSaveSalesType}
                pending={pending}
                type={null}
              />
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title={labels.syncTitle}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px]" style={{ color: STUDIO.ink4 }}>
            {view.lastSyncedAt
              ? labels.lastSynced.replace(
                  "{time}",
                  new Date(view.lastSyncedAt).toLocaleString("nb-NO")
                )
              : labels.neverSynced}
          </span>
          <button
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await syncLedgerAccountsFromFinago();
                if ("error" in result) {
                  toast.error(result.error);
                  return;
                }
                toast.success(labels.syncDone);
                await reload();
              })
            }
            style={buttonStyleFor(false)}
            type="button"
          >
            {labels.syncButton}
          </button>
        </div>
      </Panel>
    </div>
  );
}
