"use client";

import { useEffect, useRef, useState } from "react";
import { bahtText } from "@/lib/baht-text";
import { exportDocPdf } from "@/lib/doc-pdf";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";

/**
 * ตัวเอกสาร A4 (ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จ-ใบกำกับภาษี)
 * ใช้ร่วมกันระหว่างหน้าหลังบ้าน (/admin/billing/doc/[id]) กับลิงก์ที่ส่งให้ลูกค้าทาง LINE (/doc/[id])
 */

export type Kind = "quote" | "invoice" | "receipt";

export type Item = { label: string; amount: number; qty?: number; unitAmount?: number; catName?: string };
export type Invoice = {
  id: string;
  customerId: string;
  customerName: string;
  catName: string;
  items: Item[];
  subtotal: number;
  discount: number;
  deposit: number;
  promoLabel?: string;
  total: number;
  status: "pending" | "paid";
  paymentMethod?: "transfer" | "member_credit" | "cash";
  paidAt?: string;
  createdAt: string;
};
export type Buyer = { name: string; taxId?: string; branch?: string; address?: string; phone?: string };
export type Doc = {
  invoiceId: string;
  buyer?: Buyer;
  quoteNo?: string;
  quoteAt?: string;
  invoiceNo?: string;
  invoiceAt?: string;
  receiptNo?: string;
  receiptAt?: string;
  note?: string;
};
export type Data = {
  invoice: Invoice;
  doc: Doc;
  suggestedBuyer?: Buyer;
  customer: { name: string; phone: string; address: string };
  seller: {
    name: string;
    shopName: string;
    address: string;
    phone: string;
    taxId: string;
    branch: string;
    vatRegistered: boolean;
    vatRate: number;
    /** โลโก้บนเอกสาร (ตั้งค่า › ร้าน) ไม่ตั้ง = โลโก้ร้าน */
    logo?: string;
  };
  payment: { bankName: string; accountNumber: string; accountName: string };
  /** ลูกค้าผูก LINE แล้ว (เฉพาะหลังบ้าน) */
  hasLine?: boolean;
  /** ผู้ซื้อมาจากข้อมูลออกบิลที่จำไว้ของลูกค้า */
  fromProfile?: boolean;
};

export const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dmy = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00+07:00` : iso);
  return d.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" });
};
export const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86400000).toISOString();

export function docTitle(kind: Kind, vat: boolean) {
  if (kind === "quote") return { th: "ใบเสนอราคา", en: "Quotation" };
  if (kind === "invoice") return { th: "ใบแจ้งหนี้", en: "Invoice" };
  return vat
    ? { th: "ใบเสร็จรับเงิน / ใบกำกับภาษี", en: "Receipt / Tax Invoice" }
    : { th: "ใบเสร็จรับเงิน", en: "Receipt" };
}

export function docNumberOf(doc: Doc | undefined, kind: Kind) {
  if (!doc) return undefined;
  return kind === "quote" ? doc.quoteNo : kind === "invoice" ? doc.invoiceNo : doc.receiptNo;
}

/** ผู้ซื้อบนเอกสาร: ในนามบริษัทถ้าตั้งไว้ ไม่งั้นใช้ชื่อลูกค้า */
export function buyerOf(data: Data): Buyer {
  return (
    data.doc.buyer || {
      name: data.customer.name || data.invoice.customerName,
      address: data.customer.address,
      phone: data.customer.phone,
    }
  );
}

/** เอกสารทางการ: ตัดอีโมจิออกจากข้อความทุกช่อง (ชื่อบริการบางรายการตั้งไว้มีอีโมจิ) */
export function clean(s?: string) {
  return (s || "")
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * ชื่อรายการบนเอกสาร: บิลในระบบเติมชื่อน้อง ตัวคูณ และป้ายส่วนลดไว้ในชื่อ
 * บนเอกสารทางการมีคอลัมน์จำนวน/ส่วนลดแยกแล้ว และไม่โชว์ชื่อน้อง จึงถอดออก
 */
function itemLabel(raw: string) {
  return clean(
    raw
      .replace(/^🐱 .+? · /u, "")
      .replace(/ \(ลด [^)]*\)$/, "")
      .replace(/ × \d+( คืน)?$/, "")
  );
}

/** ส่วนลดเฉพาะรายการ = ราคาเต็ม (ต่อหน่วย x จำนวน) - ยอดสุทธิของรายการ */
function itemDiscount(it: Item) {
  if (it.unitAmount == null) return 0;
  return Math.max(0, Math.round((it.unitAmount * (it.qty || 1) - it.amount) * 100) / 100);
}

export function InvoiceDocument({
  data,
  kind,
  copies,
  a4,
}: {
  data: Data;
  kind: Kind;
  copies: readonly string[];
  /** จัดหน้าแบบกระดาษ A4 เสมอ (ไม่ย่อตามจอมือถือ) — ใช้ตอนสร้างไฟล์ PDF */
  a4?: boolean;
}) {
  const inv = data.invoice;
  const seller = data.seller;
  const doc = data.doc;
  const vat = !!seller.vatRegistered;
  const docNo = docNumberOf(doc, kind);
  const docDate = kind === "receipt" ? inv.paidAt || doc.receiptAt : kind === "quote" ? doc.quoteAt : doc.invoiceAt;
  const title = docTitle(kind, vat);
  // ราคาในร้านรวม VAT แล้ว — แยกฐานภาษีกับภาษีออกจากยอดสุทธิ
  const vatAmount = vat ? Math.round(((inv.total * seller.vatRate) / (100 + seller.vatRate)) * 100) / 100 : 0;
  const buyer = buyerOf(data);

  // ตัวเลือกวิธีชำระตามแบบฟอร์มใบเสร็จทั่วไป — เครดิตสมาชิกโชว์เฉพาะตอนจ่ายด้วยเครดิต
  const method = inv.paymentMethod || "transfer";
  const methods: [string, string][] = [
    ["cash", "เงินสด"],
    ["cheque", "เช็ค"],
    ["transfer", "โอนเงิน"],
    ["card", "บัตรเครดิต"],
    ...(method === "member_credit" ? ([["member_credit", "เครดิตสมาชิก"]] as [string, string][]) : []),
  ];
  const signLeft = kind === "receipt" ? "ผู้จ่ายเงิน" : kind === "quote" ? "ผู้อนุมัติ" : "ผู้รับเอกสาร";
  const signRight = kind === "receipt" ? "ผู้รับเงิน" : kind === "quote" ? "ผู้เสนอราคา" : "ผู้ออกเอกสาร";
  const hasItemDiscount = inv.items.some((it) => itemDiscount(it) > 0);
  const label = "text-latte-deep";

  return (
    <>
      <style>{`@media print { @page { size: A4; margin: 10mm; } html, body, main, .bg-catcha-gradient { background: #fff !important; } .bg-catcha-gradient, main { padding: 0 !important; margin: 0 !important; min-height: 0 !important; } .doc-page { break-after: page; min-height: 265mm; } .doc-page:last-child { break-after: auto; } } .doc-a4 .doc-page { width: 794px; min-height: 1123px; max-width: none; padding: 48px; border-radius: 0; box-shadow: none; } .doc-a4 .doc-head, .doc-a4 .doc-totals { grid-template-columns: 1fr 280px; } .doc-a4 .doc-title { font-size: 22px; } .doc-a4 .doc-table { min-width: 0; } .doc-a4 .doc-title { white-space: nowrap; } .doc-a4 .doc-pay { grid-template-columns: auto 1fr auto 1fr auto 1fr auto 1fr; }`}</style>
      <div className={a4 ? "doc-a4" : "space-y-4 print:space-y-0"}>
        {copies.map((copy, i) => (
          <article
            key={copy}
            data-doc-page
            className="doc-page relative mx-auto flex max-w-[800px] flex-col overflow-hidden rounded-catcha bg-white p-5 text-[12px] leading-relaxed text-[#333] shadow-catcha-sm sm:min-h-[1100px] sm:p-10 print:max-w-none print:rounded-none print:p-0 print:shadow-none"
          >
            {/* มุมเลขหน้า */}
            <div className="absolute right-0 top-0 h-14 w-14 bg-latte-deep [clip-path:polygon(0_0,100%_0,100%_100%)] [print-color-adjust:exact]">
              <span className="absolute right-2.5 top-1.5 text-sm font-bold text-white">{i + 1}</span>
            </div>

            {/* หัวกระดาษ: โลโก้ซ้าย ชื่อเอกสารขวา */}
            <div className="flex items-start justify-between gap-4">
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={seller.logo || "/logo.jpg"} alt="" className="h-16 max-w-[180px] object-contain object-left" />
              </div>
              <div className="pr-16 text-right">
                <p className="doc-title text-base font-bold leading-tight text-latte-deep sm:whitespace-nowrap sm:text-[22px]">{title.th}</p>
                <p className="mt-0.5 text-[11px] text-latte-deep">{copy}</p>
              </div>
            </div>

            <div className="doc-head mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_280px]">
              <div>
                <p>
                  {clean(seller.name)}
                  {seller.branch && ` (${seller.branch})`}
                </p>
                {seller.address && <p className="whitespace-pre-line">{clean(seller.address)}</p>}
                {seller.taxId && <p>เลขประจำตัวผู้เสียภาษี {seller.taxId}</p>}
                {seller.phone && <p>โทร. {seller.phone}</p>}

                <p className={`mt-3 ${label}`}>ลูกค้า</p>
                <p>
                  {clean(buyer.name)}
                  {buyer.branch && ` (${buyer.branch})`}
                </p>
                {buyer.address && <p className="whitespace-pre-line">{clean(buyer.address)}</p>}
                {buyer.taxId && <p>เลขประจำตัวผู้เสียภาษี {buyer.taxId}</p>}
              </div>
              <div>
                <dl className="grid grid-cols-[90px_1fr] gap-y-0.5 border-y border-[#d9d9d9] py-2">
                  <dt className={label}>เลขที่</dt>
                  <dd>{docNo || "-"}</dd>
                  <dt className={label}>วันที่</dt>
                  <dd>{dmy(docDate || new Date().toISOString())}</dd>
                  {kind === "quote" && (
                    <>
                      <dt className={label}>ยืนราคาถึง</dt>
                      <dd>{dmy(addDays(docDate || new Date().toISOString(), 30))}</dd>
                    </>
                  )}
                  {kind === "invoice" && (
                    <>
                      <dt className={label}>ครบกำหนด</dt>
                      <dd>{dmy(addDays(docDate || new Date().toISOString(), 7))}</dd>
                    </>
                  )}
                  <dt className={label}>อ้างอิง</dt>
                  <dd className="break-all">{inv.id.slice(-8).toUpperCase()}</dd>
                </dl>
                {buyer.phone && (
                  <dl className="grid grid-cols-[90px_1fr] border-b border-[#d9d9d9] py-2">
                    <dt className={label}>เบอร์โทร</dt>
                    <dd>{buyer.phone}</dd>
                  </dl>
                )}
              </div>
            </div>

            {/* รายการ — จอมือถือเลื่อนข้างได้ ไม่บีบชื่อรายการ */}
            <div className="mt-5 overflow-x-auto print:overflow-visible">
              <table className="doc-table w-full min-w-[560px] border-collapse print:min-w-0">
                <thead>
                  <tr className="border-y border-[#bbb] text-[11px]">
                    <th className="w-8 py-1.5 text-left font-normal">#</th>
                    <th className="py-1.5 text-left font-normal">รายละเอียด</th>
                    <th className="w-14 py-1.5 text-right font-normal">จำนวน</th>
                    <th className="w-24 py-1.5 text-right font-normal">ราคาต่อหน่วย</th>
                    {hasItemDiscount && <th className="w-20 py-1.5 text-right font-normal">ส่วนลด</th>}
                    <th className="w-24 py-1.5 text-right font-normal">มูลค่า</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((it, idx) => {
                    const qty = it.qty || 1;
                    const disc = itemDiscount(it);
                    const unit = it.unitAmount ?? (it.amount + disc) / qty;
                    return (
                      <tr key={idx} className="border-b border-[#eee] align-top">
                        <td className="py-1.5">{idx + 1}</td>
                        <td className="py-1.5">{itemLabel(it.label)}</td>
                        <td className="whitespace-nowrap py-1.5 text-right">
                          {qty}
                          {/ × \d+ คืน( \(ลด [^)]*\))?$/.test(it.label) ? " คืน" : ""}
                        </td>
                        <td className="py-1.5 text-right">{money(unit)}</td>
                        {hasItemDiscount && <td className="py-1.5 text-right">{disc > 0 ? money(disc) : ""}</td>}
                        <td className="py-1.5 text-right">{money(it.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ยอดรวม */}
            <div className="doc-totals mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_280px]">
              <p className="self-end text-[11px]">({bahtText(inv.total)})</p>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-right">
                <dt className={label}>รวมเงิน</dt>
                <dd>{money(inv.subtotal)} บาท</dd>
                {inv.discount > 0 && (
                  <>
                    <dt className={label}>ส่วนลด{inv.promoLabel ? ` (${clean(inv.promoLabel)})` : ""}</dt>
                    <dd>-{money(inv.discount)} บาท</dd>
                  </>
                )}
                {vat && (
                  <>
                    <dt className={label}>มูลค่าก่อนภาษี</dt>
                    <dd>{money(inv.total - vatAmount)} บาท</dd>
                    <dt className={label}>ภาษีมูลค่าเพิ่ม {seller.vatRate}%</dt>
                    <dd>{money(vatAmount)} บาท</dd>
                  </>
                )}
                <dt className={label}>จำนวนเงินรวมทั้งสิ้น</dt>
                <dd className="font-bold">{money(inv.total)} บาท</dd>
                {kind === "invoice" && inv.deposit > 0 && (
                  <>
                    <dt className={label}>ชำระมัดจำแล้ว</dt>
                    <dd>-{money(inv.deposit)} บาท</dd>
                    <dt className={label}>ยอดคงค้าง</dt>
                    <dd className="font-bold">{money(Math.max(0, inv.total - inv.deposit))} บาท</dd>
                  </>
                )}
              </dl>
            </div>

            {doc.note && (
              <div className="mt-5">
                <p className={label}>หมายเหตุ</p>
                <p className="whitespace-pre-line">{clean(doc.note)}</p>
              </div>
            )}

            {/* ดันส่วนชำระเงิน + ลายเซ็นลงท้ายกระดาษ */}
            <div className="min-h-8 flex-1" />

            <footer className="mt-8 text-[11px]">
              {kind === "receipt" ? (
                <div className="border-t border-[#bbb] pt-2">
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>การชำระเงินจะสมบูรณ์เมื่อบริษัทได้รับเงินเรียบร้อยแล้ว</span>
                    {methods.map(([m, l]) => (
                      <span key={m} className="inline-flex items-center gap-1">
                        <CheckBox on={method === m} />
                        {l}
                      </span>
                    ))}
                  </p>
                  <div className="doc-pay mt-2 grid grid-cols-[auto_1fr_auto_1fr] items-end gap-x-2 gap-y-2 sm:grid-cols-[auto_1fr_auto_1fr_auto_1fr_auto_1fr]">
                    <span>ธนาคาร</span>
                    <span className="border-b border-[#999] px-1 text-center">{method === "transfer" ? data.payment.bankName : ""}&nbsp;</span>
                    <span>เลขที่</span>
                    <span className="border-b border-[#999] px-1 text-center">{method === "transfer" ? data.payment.accountNumber : ""}&nbsp;</span>
                    <span>วันที่</span>
                    <span className="border-b border-[#999] px-1 text-center">{dmy(inv.paidAt)}</span>
                    <span>จำนวนเงิน</span>
                    <span className="border-b border-[#999] px-1 text-center">{money(inv.total)}</span>
                  </div>
                </div>
              ) : (
                data.payment.accountNumber && (
                  <div className="border-t border-[#bbb] pt-2">
                    <p className={label}>ช่องทางชำระเงิน</p>
                    <p>
                      โอนเข้าบัญชี {data.payment.bankName} เลขที่ {data.payment.accountNumber}
                      {data.payment.accountName && ` ชื่อบัญชี ${data.payment.accountName}`}
                    </p>
                  </div>
                )
              )}

              {/* ลายเซ็น */}
              <div className="mt-8 grid grid-cols-2 gap-8">
                <div>
                  <p>ในนาม {clean(buyer.name)}</p>
                  {buyer.branch && <p>({buyer.branch})</p>}
                  <div className="mt-12 grid grid-cols-2 gap-3 text-center">
                    <div className="border-t border-[#999] pt-1">{signLeft}</div>
                    <div className="border-t border-[#999] pt-1">วันที่</div>
                  </div>
                </div>
                <div>
                  <p className="text-right">ในนาม {clean(seller.name)}</p>
                  {seller.branch && <p className="text-right">({seller.branch})</p>}
                  <div className="mt-12 grid grid-cols-2 gap-3 text-center">
                    <div className="border-t border-[#999] pt-1">{signRight}</div>
                    <div className="border-t border-[#999] pt-1">วันที่</div>
                  </div>
                </div>
              </div>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}

/** ช่องติ๊กแบบฟอร์ม — วาดเครื่องหมายถูกเป็นเส้น ไม่ใช้ตัวอักษร/อีโมจิ */
function CheckBox({ on }: { on: boolean }) {
  return (
    <span className="inline-flex h-3.5 w-3.5 items-center justify-center border border-[#555]">
      {on && (
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
          <path d="M2 6.5 5 9l5-6" fill="none" stroke="#333" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

/** ชื่อไฟล์ เช่น RE2026100001-tax-invoice.pdf — ใช้ภาษาอังกฤษ บางเบราว์เซอร์ตัดชื่อไฟล์ภาษาไทยทิ้ง */
export function docFileName(data: Data, kind: Kind) {
  const no = docNumberOf(data.doc, kind) || data.invoice.id.slice(-8).toUpperCase();
  const name =
    kind === "quote" ? "quotation" : kind === "invoice" ? "invoice" : data.seller.vatRegistered ? "tax-invoice" : "receipt";
  return `${no}-${name}.pdf`;
}

/**
 * ปุ่มบันทึกเป็นไฟล์ PDF — วาดเอกสารแบบ A4 เต็มหน้าไว้นอกจอ แล้วแปลงเป็น PDF
 * prepare: งานก่อนสร้างไฟล์ (เช่น ออกเลขที่เอกสาร) คืนข้อมูลล่าสุด หรือ null = ยกเลิก
 */
export function DocPdfButton({
  data,
  kind,
  copies,
  prepare,
  className,
  label = "บันทึก PDF",
}: {
  data: Data;
  kind: Kind;
  copies: readonly string[];
  prepare?: () => Promise<Data | null>;
  className?: string;
  label?: string;
}) {
  const [job, setJob] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!job || !ref.current) return;
    let cancelled = false;
    // รอรูปโลโก้โหลดก่อนแปลง ไม่งั้นหัวกระดาษจะว่าง
    const imgs = [...ref.current.querySelectorAll("img")];
    Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))))
      .then(() => exportDocPdf(ref.current!, docFileName(job, kind)))
      .then((how) => !cancelled && how === "saved" && toast("บันทึกไฟล์ PDF แล้ว", "success"))
      .catch(() => !cancelled && toast("สร้างไฟล์ PDF ไม่สำเร็จ ลองใหม่อีกครั้ง", "error"))
      .finally(() => {
        if (cancelled) return;
        setJob(null);
        setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job, kind]);

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const d = prepare ? await prepare() : data;
          if (!d) {
            setBusy(false);
            return;
          }
          setJob(d);
        }}
        className={className}
      >
        <Icon name="download" size={16} />
        {busy ? "กำลังสร้างไฟล์…" : label}
      </button>
      {job && (
        <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 print:hidden">
          <div ref={ref}>
            <InvoiceDocument data={job} kind={kind} copies={copies} a4 />
          </div>
        </div>
      )}
    </>
  );
}
