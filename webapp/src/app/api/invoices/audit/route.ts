import { NextResponse } from "next/server";
import { auditBills } from "@/lib/bill-audit";
import { listBookings } from "@/lib/bookings-store";
import { listFinance } from "@/lib/finance-store";
import { listInvoices } from "@/lib/invoices-store";

/** ตรวจบิลเทียบกับนัดทั้งร้าน (หน้า /admin/billing/check) — อ่านอย่างเดียว */
export async function GET() {
  const [invoices, bookings, finance] = await Promise.all([
    listInvoices(),
    listBookings(),
    listFinance(),
  ]);
  return NextResponse.json({
    issues: auditBills(invoices, bookings, finance),
    checked: { invoices: invoices.length, bookings: bookings.length },
  });
}
