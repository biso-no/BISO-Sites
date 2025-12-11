import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import fs from "node:fs";
import path from "node:path";

type ExpenseAttachment = {
  description: string;
  date: string;
  amount: number;
};

type ExpenseTemplateData = {
  reimbursementNumber: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  bankAccount: string;
  invoiceDate: string;
  campusAndUnit: string;
  purpose: string;
  attachments: ExpenseAttachment[];
  subtotal: number;
  total: number;
};

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
    width: "50%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  colDate: {
    width: "25%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  colAmount: {
    width: "25%",
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
    width: "50%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  totalLabelText: {
    width: "25%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  totalAmount: {
    width: "25%",
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
            <View style={styles.detailsRowLast}>
              <Text style={styles.detailsLabel}>Formål:</Text>
              <Text style={styles.purposeValue}>{data.purpose}</Text>
            </View>
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
