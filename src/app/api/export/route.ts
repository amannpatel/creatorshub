import { getCurrentUser } from "@/server/auth/session";
import { exportAll } from "@/server/queries";
import { STATUS_META, PAYMENT_METHOD_LABEL } from "@/lib/constants";
import { paymentState } from "@/lib/finance";
import { todayIn } from "@/lib/dates";
import { minorToInputString } from "@/lib/money";

function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const format = new URL(request.url).searchParams.get("format") ?? "json";
  const data = await exportAll(user);
  const stamp = todayIn(user.settings.timezone);
  const headers = (type: string, name: string) => ({
    "Content-Type": type,
    "Content-Disposition": `attachment; filename="${name}"`,
    "Cache-Control": "no-store",
  });

  if (format === "csv") {
    const today = todayIn(user.settings.timezone);
    const rows: unknown[][] = [
      ["Brand", "Title", "Status", "Type", "Platforms", "Contact", "Email", "Inquiry", "Submission", "Publish", "Payment due", "Currency", "Agreed", "Received", "Outstanding", "Payment status", "Invoice"],
      ...data.collaborations.map((c) => {
        const p = paymentState(c, today);
        return [
          c.brandName,
          c.title,
          STATUS_META[c.status].label,
          c.type,
          c.platforms.join(" "),
          c.contactName,
          c.contactEmail,
          c.inquiryDate,
          c.submissionDeadline,
          c.publishDate,
          c.paymentDueDate,
          c.currency,
          minorToInputString(c.amountMinor) || "0",
          minorToInputString(c.receivedMinor) || "0",
          minorToInputString(p.outstandingMinor) || "0",
          p.paymentStatus,
          c.invoiceNumber,
        ];
      }),
    ];
    return new Response(toCsv(rows), { headers: headers("text/csv; charset=utf-8", `creatorshub-collaborations-${stamp}.csv`) });
  }

  if (format === "payments-csv") {
    const rows: unknown[][] = [
      ["Received on", "Brand", "Collaboration", "Currency", "Amount", "Method", "Reference", "Notes"],
      ...data.payments.map((p) => [p.receivedOn, p.brandName, p.collabTitle, p.currency, minorToInputString(p.amountMinor), PAYMENT_METHOD_LABEL[p.method], p.reference, p.notes]),
    ];
    return new Response(toCsv(rows), { headers: headers("text/csv; charset=utf-8", `creatorshub-payments-${stamp}.csv`) });
  }

  return new Response(JSON.stringify(data, null, 2), { headers: headers("application/json", `creatorshub-export-${stamp}.json`) });
}
