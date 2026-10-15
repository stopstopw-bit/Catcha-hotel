import { NextRequest, NextResponse } from "next/server";
import { getInvoice } from "@/lib/invoices-store";
import { getCustomer } from "@/lib/customers-store";
import { getSiteConfig } from "@/lib/config-store";
import {
  getInvoiceDoc,
  issueDocNumber,
  lastBuyerForCustomer,
  saveBuyer,
  type DocKind,
} from "@/lib/invoice-docs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?invoiceId= — ข้อมูลครบสำหรับพิมพ์เอกสาร: บิล + ผู้ขาย + ผู้ซื้อ + เลขที่ */
export async function GET(req: NextRequest) {
  const invoiceId = req.nextUrl.searchParams.get("invoiceId") || "";
  const invoice = invoiceId ? await getInvoice(invoiceId) : undefined;
  if (!invoice || invoice.deletedAt) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const [doc, customer, config] = await Promise.all([
    getInvoiceDoc(invoiceId),
    invoice.customerId ? getCustomer(invoice.customerId) : Promise.resolve(undefined),
    getSiteConfig(),
  ]);
  const suggestedBuyer = doc?.buyer ? undefined : await lastBuyerForCustomer(invoice.customerId);
  const b = config.business;
  return NextResponse.json({
    invoice,
    doc: doc || { invoiceId },
    suggestedBuyer,
    customer: customer
      ? { name: customer.name, phone: customer.phone || "", address: customer.address || "" }
      : { name: invoice.customerName, phone: "", address: "" },
    seller: {
      name: b.legalName || b.name,
      shopName: b.name,
      address: b.location?.th || "",
      phone: b.phones?.filter(Boolean)[0] || "",
      taxId: b.taxId || "",
      branch: b.taxBranch || "",
      vatRegistered: !!b.vatRegistered,
      vatRate: b.vatRate ?? 7,
    },
    payment: config.payment,
  });
}

/**
 * POST { invoiceId, buyer?, note? } — บันทึกผู้ซื้อ (ในนามบริษัท)
 * POST { invoiceId, issue: "quote" | "invoice" | "receipt" } — ออกเลขที่เอกสาร (ครั้งแรกเท่านั้น)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const invoiceId = String(body.invoiceId || "");
  const invoice = invoiceId ? await getInvoice(invoiceId) : undefined;
  if (!invoice || invoice.deletedAt) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (body.issue) {
    const kind = String(body.issue) as DocKind;
    if (!["quote", "invoice", "receipt"].includes(kind)) {
      return NextResponse.json({ error: "bad_kind" }, { status: 400 });
    }
    // ใบเสร็จออกได้เฉพาะบิลที่รับเงินแล้ว — กันออกใบเสร็จ/ใบกำกับภาษีก่อนได้เงินจริง
    if (kind === "receipt" && invoice.status !== "paid") {
      return NextResponse.json({ error: "not_paid" }, { status: 400 });
    }
    const res = await issueDocNumber(invoiceId, invoice.customerId, kind);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
    return NextResponse.json({ ok: true, doc: res.doc });
  }

  const res = await saveBuyer(
    invoiceId,
    invoice.customerId,
    body.buyer ?? null,
    body.note !== undefined ? String(body.note) : undefined
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  return NextResponse.json({ ok: true, doc: await getInvoiceDoc(invoiceId) });
}
