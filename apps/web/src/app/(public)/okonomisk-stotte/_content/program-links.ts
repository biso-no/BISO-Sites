/**
 * The volatile links on /okonomisk-stotte — application form, documents,
 * contact addresses, open/closed — as opposed to its prose, which lives in
 * `packages/i18n/messages/{no,en}/fundingProgram.json`.
 *
 * The defaults were carried over from the legacy WordPress page
 * (`/sok-okonomisk-stotte`). They are the fallback whenever the
 * `funding_programs` row is missing or leaves a field blank — see
 * `resolveLinks` in `../page.tsx`.
 */
export interface FundingSupportDocument {
  href: string;
  kind: "doc" | "sheet";
  label: string;
}

export interface FundingSupportLinks {
  applicationUrl: string;
  boardEmail: string;
  budgetUrl: string;
  financeEmail: string;
  guidelinesUrl: string;
  isOpen: boolean;
  /** When the Appwrite row supplies its own list, it replaces the three defaults wholesale. */
  overrideDocuments: FundingSupportDocument[] | null;
  termsUrl: string;
}

export const DEFAULT_PROGRAM_LINKS = {
  applicationUrl:
    "https://forms.office.com/Pages/ResponsePage.aspx?id=uRehdEOThky0TTmMiLoe2FOe5pmVgIlCoeSQuuBKzqdUMVhKSjVYVEdZTDZEU0hMM1FEWkJOMTVSOS4u",
  boardEmail: "board@biso.no",
  budgetUrl:
    "https://bistudentorganisasjon-my.sharepoint.com/:x:/g/personal/board_biso_no/EShBxvGQKdtLuv6-ng9-L1MBGbnuW1FbW5PX8E_J4nyAgw?e=RTJjjw",
  financeEmail: "manager.finance@biso.no",
  guidelinesUrl:
    "https://bistudentorganisasjon-my.sharepoint.com/:p:/g/personal/board_biso_no/EThQ35fgR4NImshiAX2qvlABVypujhy73ON4jaAueix4mQ?e=gjZp7G",
  isOpen: true,
  overrideDocuments: null,
  termsUrl:
    "https://bistudentorganisasjon-my.sharepoint.com/:b:/g/personal/board_biso_no/EdHeZW5FxZFPg0ayHcHSxfoBKAiQxvBFIJ5s3q3iLjNgrg?e=hrlCUb",
} as const satisfies FundingSupportLinks;
