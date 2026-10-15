import { NextRequest, NextResponse } from "next/server";
import { getInvoice, listInvoices } from "@/lib/invoices-store";
import { getCustomer } from "@/lib/customers-store";
import { getSiteConfig } from "@/lib/config-store";
import { pushLineMessage } from "@/lib/line";
import { docShareUrl } from "@/lib/doc-share";
import { getAppUrl } from "@/lib/app-url";
import { buildDocPayload } from "@/lib/invoice-docs-payload";
import {
  getBuyerProfile,
  getInvoiceDoc,
  saveBuyerProfile,
  issueDocNumber,
  listIssuedDocs,
  saveBuyer,
  type DocKind,
  type InvoiceDoc,
} from "@/lib/invoice-docs-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: DocKind[] = ["quote", "invoice", "receipt"];

/**
 * GET ?invoiceId= — ข้อมูลครบสำหรับพิมพ์เอกสาร: บิล + ผู้ขาย + ผู้ซื้อ + เลขที่
 * GET ?list=1 — เอกสารทุกใบที่เคยออกเลขที่ไปแล้ว (ใหม่สุดก่อน) ไว้เรียกดูย้อนหลัง
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("list")) {
    const [docs, invoices] = await Promise.all([listIssuedDocs(), listInvoices()]);
    const byId = new Map(invoices.map((i) => [i.id, i]));
    const rows = docs.flatMap((d) => {
      const inv = byId.get(d.invoiceId);
      if (!inv || inv.deletedAt) return [];
      return KINDS.flatMap((kind) => {
        const no = kind === "quote" ? d.quoteNo : kind === "invoice" ? d.invoiceNo : d.receiptNo;
        const at = kind === "quote" ? d.quoteAt : kind === "invoice" ? d.invoiceAt : d.receiptAt;
        if (!no) return [];
        return [
          {
            invoiceId: d.invoiceId,
            kind,
            no,
            at: at || "",
            buyerName: d.buyer?.name || inv.customerName,
            company: !!d.buyer,
            customerName: inv.customerName,
            catName: inv.catName,
            total: inv.total,
            status: inv.status,
          },
        ];
      });
    });
    rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    return NextResponse.json({ docs: rows });
  }

  const profileOf = req.nextUrl.searchParams.get("profile");
  if (profileOf) {
    return NextResponse.json({ buyer: (await getBuyerProfile(profileOf)) || null });
  }

  const data = await buildDocPayload(req.nextUrl.searchParams.get("invoiceId") || "");
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(data);
}

const TITLE: Record<DocKind, string> = { quote: "ใบเสนอราคา", invoice: "ใบแจ้งหนี้", receipt: "ใบเสร็จรับเงิน" };

function docMessage(opts: {
  title: string;
  no: string;
  shop: string;
  customer: string;
  total: number;
  url: string;
}) {
  const row = (label: string, value: string, bold = false) => ({
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: "#8a7563", flex: 2 },
      { type: "text", text: value, size: "sm", color: "#4a3426", flex: 3, align: "end", weight: bold ? "bold" : "regular", wrap: true },
    ],
  });
  return {
    type: "flex",
    altText: `${opts.title} ${opts.no} จาก ${opts.shop}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "DOCUMENT", size: "xs", color: "#b08a64", weight: "bold" },
          { type: "text", text: opts.title, size: "lg", weight: "bold", color: "#4a3426", wrap: true },
          { type: "separator", margin: "md" },
          row("เลขที่", opts.no),
          row("ลูกค้า", opts.customer),
          row("ยอดรวม", `${opts.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`, true),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#5b3a29",
            action: { type: "uri", label: "เปิดดู / ดาวน์โหลด PDF", uri: opts.url },
          },
        ],
      },
    },
  };
}

/**
 * POST { invoiceId, buyer?, note? } — บันทึกผู้ซื้อ (ในนามบริษัท)
 * POST { invoiceId, issue: kind } — ออกเลขที่เอกสาร (ครั้งแรกเท่านั้น)
 * POST { invoiceId, send: kind } — ออกเลขที่ (ถ้ายังไม่มี) แล้วส่งลิงก์เอกสารให้ลูกค้าทาง LINE
 * POST { invoiceId, link: kind } — ออกเลขที่แล้วคืนลิงก์ให้ร้านก๊อปไปส่งเอง (ลูกค้ายังไม่ผูก LINE)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // POST { profile: customerId, buyer } — บันทึก/ลบข้อมูลออกบิลประจำตัวลูกค้า (จากหน้าลูกค้า)
  if (body.profile) {
    const customer = await getCustomer(String(body.profile));
    if (!customer) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const res = await saveBuyerProfile(customer.id, body.buyer ?? null);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
    return NextResponse.json({ ok: true, buyer: (await getBuyerProfile(customer.id)) || null });
  }

  const invoiceId = String(body.invoiceId || "");
  const invoice = invoiceId ? await getInvoice(invoiceId) : undefined;
  if (!invoice || invoice.deletedAt) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const kindArg = body.issue || body.send || body.link;
  if (kindArg) {
    const kind = String(kindArg) as DocKind;
    if (!KINDS.includes(kind)) {
      return NextResponse.json({ error: "bad_kind" }, { status: 400 });
    }
    // ใบเสร็จออกได้เฉพาะบิลที่รับเงินแล้ว — กันออกใบเสร็จ/ใบกำกับภาษีก่อนได้เงินจริง
    if (kind === "receipt" && invoice.status !== "paid") {
      return NextResponse.json({ error: "not_paid" }, { status: 400 });
    }

    let to = "";
    if (body.send) {
      const customer = invoice.customerId ? await getCustomer(invoice.customerId) : undefined;
      to = invoice.lineUserId || customer?.lineUserId || "";
      if (!to) return NextResponse.json({ error: "no_line" }, { status: 400 });
    }

    // ออกเลขที่ = เอกสารออกจริงแล้ว → ล็อกผู้ซื้อลงบิลนี้ (แก้ข้อมูลที่จำไว้ทีหลังจะไม่เปลี่ยนเอกสารที่ออกไปแล้ว)
    const before = await getInvoiceDoc(invoiceId);
    if (!before?.buyer) {
      const profile = await getBuyerProfile(invoice.customerId);
      if (profile) await saveBuyer(invoiceId, invoice.customerId, profile);
    }

    const res = await issueDocNumber(invoiceId, invoice.customerId, kind);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
    if (body.link) {
      return NextResponse.json({ ok: true, doc: res.doc, url: docShareUrl(getAppUrl(), invoiceId, kind) });
    }
    if (!body.send) return NextResponse.json({ ok: true, doc: res.doc });

    const doc: InvoiceDoc = res.doc;
    const config = await getSiteConfig();
    const vat = !!config.business.vatRegistered;
    const title = kind === "receipt" && vat ? "ใบเสร็จรับเงิน / ใบกำกับภาษี" : TITLE[kind];
    const no = (kind === "quote" ? doc.quoteNo : kind === "invoice" ? doc.invoiceNo : doc.receiptNo) || "";
    const url = docShareUrl(getAppUrl(), invoiceId, kind);
    try {
      await pushLineMessage(to, [
        docMessage({
          title,
          no,
          shop: config.business.name,
          customer: doc.buyer?.name || invoice.customerName,
          total: invoice.total,
          url,
        }),
      ]);
    } catch (e) {
      return NextResponse.json(
        { error: "line_failed", detail: e instanceof Error ? e.message : String(e), doc, url },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true, doc, url });
  }

  // useCustomer: ออกในชื่อลูกค้าเฉพาะบิลนี้ (แม้ลูกค้าจะมีข้อมูลบริษัทที่จำไว้)
  let buyer = body.buyer ?? null;
  if (body.useCustomer) {
    const customer = invoice.customerId ? await getCustomer(invoice.customerId) : undefined;
    buyer = {
      name: customer?.name || invoice.customerName,
      phone: customer?.phone || "",
      address: customer?.address || "",
    };
  }
  const res = await saveBuyer(
    invoiceId,
    invoice.customerId,
    buyer,
    body.note !== undefined ? String(body.note) : undefined
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 500 });
  // remember: จำข้อมูลนี้เป็นค่าประจำของลูกค้า ใช้กับบิลถัดไปอัตโนมัติ
  if (body.remember && invoice.customerId) {
    await saveBuyerProfile(invoice.customerId, body.useCustomer ? null : buyer);
  }
  return NextResponse.json({ ok: true, doc: await getInvoiceDoc(invoiceId) });
}
