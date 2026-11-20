// Which columns the cover sheet's receipt table has. A sheet with nothing to
// say about type, account or project (the posting path) keeps its original
// three columns; one with findings gets the extra three.

interface ColumnSource {
  account?: string;
  project?: string;
  type?: string;
}

export interface PdfColumns {
  showDetails: boolean;
  widths: {
    account: string;
    amount: string;
    date: string;
    description: string;
    project: string;
    totalAmount: string;
    totalBlank: string;
    totalLabel: string;
    type: string;
  };
}

const PLAIN: PdfColumns["widths"] = {
  account: "0%",
  amount: "25%",
  date: "25%",
  description: "50%",
  project: "0%",
  totalAmount: "25%",
  totalBlank: "50%",
  totalLabel: "25%",
  type: "0%",
};

// The date is 14% so a 10-character date fits on one line with its padding.
const DETAILED: PdfColumns["widths"] = {
  account: "14%",
  amount: "16%",
  date: "14%",
  description: "24%",
  project: "16%",
  totalAmount: "16%",
  totalBlank: "68%",
  totalLabel: "16%",
  type: "16%",
};

export function pdfColumns(attachments: ColumnSource[]): PdfColumns {
  const showDetails = attachments.some((att) =>
    [att.type, att.account, att.project].some((value) => value?.trim())
  );
  return { showDetails, widths: showDetails ? DETAILED : PLAIN };
}
