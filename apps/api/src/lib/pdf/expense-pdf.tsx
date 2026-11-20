import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Image,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

interface ExpenseAttachment {
  /** Account label such as "7140 Reise"; empty or absent when none. */
  account?: string;
  amount: number;
  date: string;
  description: string;
  /** Project name; empty or absent when none. */
  project?: string;
  /** Type name, or the student's own text. */
  type?: string;
}

interface ExpenseTemplateData {
  address: string;
  attachments: ExpenseAttachment[];
  bankAccount: string;
  campusAndUnit: string;
  email: string;
  /** The event the expense belongs to; the row is left out when empty. */
  event?: string;
  /** What the AI check found, in plain words; the row is left out when none. */
  flags?: string[];
  invoiceDate: string;
  name: string;
  /** The occasion; the row is left out when empty. */
  occasion?: string;
  phone: string;
  purpose: string;
  reimbursementNumber: string;
  subtotal: number;
  total: number;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    marginBottom: 30,
  },
  logoSection: {
    width: 150,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 10,
  },
  orgName: {
    fontSize: 10,
    lineHeight: 1.4,
  },
  infoSection: {
    flex: 1,
    paddingLeft: 30,
  },
  title: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 15,
    fontFamily: "Helvetica-Bold",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  infoLabel: {
    width: 110,
    fontSize: 10,
  },
  infoValue: {
    flex: 1,
    fontSize: 10,
  },
  detailsSection: {
    marginTop: 20,
  },
  detailsTable: {
    marginBottom: 20,
  },
  detailsRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    borderBottomWidth: 0,
  },
  detailsRowLast: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
  },
  detailsLabel: {
    width: 130,
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: "#000",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  detailsValue: {
    flex: 1,
    padding: 8,
    fontSize: 10,
  },
  purposeValue: {
    flex: 1,
    padding: 8,
    fontSize: 10,
    minHeight: 50,
  },
  expensesTable: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  colDescription: {
    width: "26%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  colDate: {
    width: "11%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  colType: {
    width: "17%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  colAccount: {
    width: "15%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  colProject: {
    width: "16%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  colAmount: {
    width: "15%",
    padding: 6,
    textAlign: "right",
  },
  headerText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  cellText: {
    fontSize: 10,
  },
  totalRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  totalLabel: {
    width: "70%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  totalLabelText: {
    width: "15%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  totalAmount: {
    width: "15%",
    padding: 6,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
});

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
  }).format(amount);
}

function getLogoBase64(): string {
  const logoPath = path.join(process.cwd(), "public", "logo.png");
  const logoBuffer = fs.readFileSync(logoPath);
  return `data:image/png;base64,${logoBuffer.toString("base64")}`;
}

function ExpensePdfDocument({ data }: { data: ExpenseTemplateData }) {
  const logoBase64 = getLogoBase64();
  const detailRows = [
    { label: "Anledning:", value: data.occasion?.trim() ?? "" },
    { label: "Arrangement:", value: data.event?.trim() ?? "" },
    { label: "Merknader:", value: (data.flags ?? []).join("\n") },
  ].filter((row) => row.value);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            <Image src={logoBase64} style={styles.logo} />
            <Text style={styles.orgName}>BI Studentorganisasjon</Text>
            <Text style={styles.orgName}>Nydalsveien 37</Text>
            <Text style={styles.orgName}>0484 Oslo</Text>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.title}>REFUSJON</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Refusjonsnummer:</Text>
              <Text style={styles.infoValue}>{data.reimbursementNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Navn:</Text>
              <Text style={styles.infoValue}>{data.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Adresse:</Text>
              <Text style={styles.infoValue}>{data.address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Telefon:</Text>
              <Text style={styles.infoValue}>{data.phone}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>E-post:</Text>
              <Text style={styles.infoValue}>{data.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Bankkonto:</Text>
              <Text style={styles.infoValue}>{data.bankAccount}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Fakturadato:</Text>
              <Text style={styles.infoValue}>{data.invoiceDate}</Text>
            </View>
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
          <View style={styles.detailsTable}>
            <View style={styles.detailsRow}>
              <Text style={styles.detailsLabel}>Enhet/økonomiansvarlig:</Text>
              <Text style={styles.detailsValue}>{data.campusAndUnit}</Text>
            </View>
            <View
              style={
                detailRows.length === 0
                  ? styles.detailsRowLast
                  : styles.detailsRow
              }
            >
              <Text style={styles.detailsLabel}>Formål:</Text>
              <Text style={styles.purposeValue}>{data.purpose}</Text>
            </View>
            {detailRows.map((row, index) => (
              <View
                key={row.label}
                style={
                  index === detailRows.length - 1
                    ? styles.detailsRowLast
                    : styles.detailsRow
                }
              >
                <Text style={styles.detailsLabel}>{row.label}</Text>
                <Text style={styles.detailsValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* Expenses Table */}
          <View style={styles.expensesTable}>
            <View style={styles.tableHeader}>
              <View style={styles.colDescription}>
                <Text style={styles.headerText}>Beskrivelse</Text>
              </View>
              <View style={styles.colDate}>
                <Text style={styles.headerText}>Dato</Text>
              </View>
              <View style={styles.colType}>
                <Text style={styles.headerText}>Type</Text>
              </View>
              <View style={styles.colAccount}>
                <Text style={styles.headerText}>Konto</Text>
              </View>
              <View style={styles.colProject}>
                <Text style={styles.headerText}>Prosjekt</Text>
              </View>
              <View style={styles.colAmount}>
                <Text style={styles.headerText}>Beløp</Text>
              </View>
            </View>

            {data.attachments.map((att, index) => (
              <View key={`att-${index}`} style={styles.tableRow}>
                <View style={styles.colDescription}>
                  <Text style={styles.cellText}>{att.description}</Text>
                </View>
                <View style={styles.colDate}>
                  <Text style={styles.cellText}>{att.date}</Text>
                </View>
                <View style={styles.colType}>
                  <Text style={styles.cellText}>{att.type ?? ""}</Text>
                </View>
                <View style={styles.colAccount}>
                  <Text style={styles.cellText}>{att.account ?? ""}</Text>
                </View>
                <View style={styles.colProject}>
                  <Text style={styles.cellText}>{att.project ?? ""}</Text>
                </View>
                <View style={styles.colAmount}>
                  <Text style={styles.cellText}>
                    {formatCurrency(att.amount)}
                  </Text>
                </View>
              </View>
            ))}

            {/* Subtotal */}
            <View style={styles.totalRow}>
              <View style={styles.totalLabel} />
              <Text style={styles.totalLabelText}>SUBTOTAL</Text>
              <Text style={styles.totalAmount}>
                {formatCurrency(data.subtotal)}
              </Text>
            </View>

            {/* Total */}
            <View style={styles.totalRow}>
              <View style={styles.totalLabel} />
              <Text style={styles.totalLabelText}>TOTALT</Text>
              <Text style={styles.totalAmount}>
                {formatCurrency(data.total)}
              </Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function generateExpensePdf(
  data: ExpenseTemplateData
): Promise<Buffer> {
  const pdfBuffer = await renderToBuffer(<ExpensePdfDocument data={data} />);
  return Buffer.from(pdfBuffer);
}

export type { ExpenseTemplateData };
