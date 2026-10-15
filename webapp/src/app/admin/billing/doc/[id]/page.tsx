"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { bahtText } from "@/lib/baht-text";
import { Icon } from "@/components/Icon";
import { EmptyState, Segmented } from "@/components/ui";
import { toast } from "@/components/Toast";

/**
 * เอกสารทางการจากบิล — ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน (ใบกำกับภาษีถ้าร้านจด VAT)
 * ออกในนามบริษัทได้ (ชื่อ ที่อยู่ เลขผู้เสียภาษี สาขาของผู้ซื้อ) · พิมพ์ / บันทึก PDF จากเบราว์เซอร์
 * เลขที่เอกสารออกตอนกดพิมพ์ครั้งแรก แล้วคงที่ (พิมพ์ซ้ำได้เลขเดิม)
 */

type Kind = "quote" | "invoice" | "receipt";

type Item = { label: string; amount: number; qty?: number; unitAmount?: number; catName?: string };
type Invoice = {
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
type Buyer = { name: string; taxId?: string; branch?: string; address?: string; phone?: string };
type Doc = {
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
type Data = {
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
  };
  payment: { bankName: string; accountNumber: string; accountName: string };
};

const money = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (iso?: string) => {
  if (!iso) return "-";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00+07:00` : iso);
  return d.toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" });
};
const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86400000).toISOString();

export default function InvoiceDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const search = useSearchParams();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>((search.get("type") as Kind) || "receipt");
  const [withCopy, setWithCopy] = useState(true);
  const [editBuyer, setEditBuyer] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch(`/api/invoice-docs?invoiceId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Data | null) => {
        setData(d);
        // ยังไม่จ่ายเงิน → เปิดเป็นใบแจ้งหนี้แทนใบเสร็จ
        if (d && d.invoice.status !== "paid" && !search.get("type")) setKind("invoice");
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const inv = data?.invoice;
  const seller = data?.seller;
  const doc = data?.doc;
  const vat = !!seller?.vatRegistered;

  const docNo = doc ? (kind === "quote" ? doc.quoteNo : kind === "invoice" ? doc.invoiceNo : doc.receiptNo) : undefined;
  const docDate =
    kind === "receipt" ? inv?.paidAt || doc?.receiptAt : kind === "quote" ? doc?.quoteAt : doc?.invoiceAt;

  const title = useMemo(() => {
    if (kind === "quote") return { th: "ใบเสนอราคา", en: "Quotation" };
    if (kind === "invoice") return { th: "ใบแจ้งหนี้", en: "Invoice" };
    return vat
      ? { th: "ใบเสร็จรับเงิน / ใบกำกับภาษี", en: "Receipt / Tax Invoice" }
      : { th: "ใบเสร็จรับเงิน", en: "Receipt" };
  }, [kind, vat]);

  // ราคาในร้านรวม VAT แล้ว — แยกฐานภาษีกับภาษีออกจากยอดสุทธิ
  const vatAmount = inv && vat ? Math.round(((inv.total * seller!.vatRate) / (100 + seller!.vatRate)) * 100) / 100 : 0;

  const print = async () => {
    if (!inv) return;
    if (!docNo) {
      setBusy(true);
      const res = await fetch("/api/invoice-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: inv.id, issue: kind }),
      });
      const d = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) {
        toast(d.error === "not_paid" ? "ออกใบเสร็จได้หลังรับเงินแล้วเท่านั้น" : "ออกเลขที่เอกสารไม่สำเร็จ", "error");
        return;
      }
      setData((cur) => (cur ? { ...cur, doc: d.doc } : cur));
      // รอให้เลขที่ขึ้นบนหน้าก่อนเปิดหน้าต่างพิมพ์
      setTimeout(() => window.print(), 150);
      return;
    }
    window.print();
  };

  if (loading) return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  if (!data || !inv || !seller || !doc) {
    return (
      <div className="rounded-catcha bg-card pb-6 text-center shadow-catcha-sm">
        <EmptyState icon="receipt" title="ไม่พบบิลนี้" sub="อาจถูกลบไปแล้ว" />
        <Link href="/admin/billing" className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-paper px-4 text-xs font-bold text-brown">
          <Icon name="back" size={15} />
          กลับหน้าบิล
        </Link>
      </div>
    );
  }

  const buyer: Buyer = doc.buyer || {
    name: data.customer.name || inv.customerName,
    address: data.customer.address,
    phone: data.customer.phone,
  };
  const copies = kind === "receipt" && withCopy ? (["ต้นฉบับ", "สำเนา"] as const) : (["ต้นฉบับ"] as const);

  return (
    <div>
      {/* แถบเครื่องมือ (ไม่พิมพ์) */}
      <div className="mb-4 space-y-3 print:hidden">
        <div className="flex items-center gap-2">
          <Link href="/admin/billing" aria-label="กลับ" className="flex h-10 w-10 items-center justify-center rounded-full bg-paper text-brown">
            <Icon name="back" size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Documents</p>
            <p className="truncate text-sm font-extrabold text-catcha-chocolate">
              {inv.customerName} · {money(inv.total)} ฿
            </p>
          </div>
          <button
            type="button"
            onClick={print}
            disabled={busy}
            className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full bg-catcha-chocolate px-4 text-sm font-extrabold text-card disabled:opacity-50"
          >
            <Icon name="download" size={16} />
            พิมพ์ / PDF
          </button>
        </div>
        <Segmented
          value={kind}
          onChange={(k) => {
            if (k === "receipt" && inv.status !== "paid") {
              toast("บิลนี้ยังไม่ได้รับเงิน — ออกใบเสร็จได้หลังรับชำระ", "error");
              return;
            }
            setKind(k);
          }}
          options={[
            { id: "quote", label: "ใบเสนอราคา" },
            { id: "invoice", label: "ใบแจ้งหนี้" },
            { id: "receipt", label: vat ? "ใบกำกับภาษี" : "ใบเสร็จ" },
          ]}
        />
        <button
          type="button"
          onClick={() => setEditBuyer(true)}
          className="flex min-h-[56px] w-full items-center gap-3 rounded-catcha-sm border border-catcha-line bg-card px-3 text-left shadow-catcha-sm"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-honey/35 text-catcha-chocolate">
            <Icon name="team" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold text-catcha-chocolate">
              {doc.buyer ? doc.buyer.name : "ออกในนามบริษัท / นิติบุคคล"}
            </span>
            <span className="block truncate text-[11px] text-brown-soft">
              {doc.buyer
                ? [doc.buyer.taxId && `เลขผู้เสียภาษี ${doc.buyer.taxId}`, doc.buyer.branch].filter(Boolean).join(" · ") || "แตะเพื่อแก้ไข"
                : data.suggestedBuyer
                  ? `ใช้ข้อมูลครั้งก่อนได้: ${data.suggestedBuyer.name}`
                  : "ใส่ชื่อบริษัท ที่อยู่ เลขผู้เสียภาษี — ไม่ใส่ = ออกในชื่อลูกค้า"}
            </span>
          </span>
          <Icon name="chevron" size={16} className="text-brown-faint" />
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-brown-soft">
          <span>
            เลขที่: <b className="text-brown">{docNo || "ออกให้อัตโนมัติเมื่อกดพิมพ์"}</b>
          </span>
          {kind === "receipt" && (
            <label className="flex min-h-[36px] items-center gap-1.5 font-bold">
              <input type="checkbox" checked={withCopy} onChange={(e) => setWithCopy(e.target.checked)} className="h-4 w-4 accent-latte-deep" />
              พิมพ์สำเนาด้วย
            </label>
          )}
        </div>
        {vat && kind === "receipt" && !doc.buyer?.taxId && (
          <p className="flex gap-2 rounded-catcha-sm bg-honey/20 px-3 py-2 text-[11px] font-bold text-catcha-chocolate">
            <Icon name="alert" size={15} className="mt-px shrink-0" />
            ลูกค้าบริษัทที่จะใช้ใบกำกับภาษีเต็มรูป ต้องมีชื่อ ที่อยู่ และเลขผู้เสียภาษีของผู้ซื้อ
          </p>
        )}
        {!seller.taxId && (
          <p className="flex gap-2 rounded-catcha-sm bg-paper px-3 py-2 text-[11px] text-brown-soft">
            <Icon name="settings" size={15} className="mt-px shrink-0" />
            ยังไม่ได้ใส่เลขผู้เสียภาษีของร้าน — ตั้งได้ที่ ตั้งค่า › ร้าน
          </p>
        )}
      </div>

      {/* ตัวเอกสาร (A4) */}
      <style>{`@media print { @page { size: A4; margin: 10mm; } html, body, main, .bg-catcha-gradient { background: #fff !important; } .doc-page { break-after: page; } .doc-page:last-child { break-after: auto; } }`}</style>
      <div className="space-y-4 print:space-y-0">
        {copies.map((copy, i) => (
          <article
            key={copy}
            className="doc-page relative mx-auto max-w-[800px] overflow-hidden rounded-catcha bg-white p-5 text-[12px] leading-relaxed text-[#333] shadow-catcha-sm sm:p-8 print:max-w-none print:rounded-none print:p-0 print:shadow-none"
          >
            {/* มุมเลขหน้า */}
            <div className="absolute right-0 top-0 h-12 w-12 bg-latte-deep [clip-path:polygon(0_0,100%_0,100%_100%)] print:[print-color-adjust:exact]">
              <span className="absolute right-2 top-1.5 text-sm font-bold text-white">{i + 1}</span>
            </div>

            <header className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_minmax(0,280px)] print:grid-cols-[1fr_280px]">
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.jpg" alt="" className="mb-2 h-12 w-12 rounded-lg object-cover" />
                <p className="font-bold">
                  {seller.name}
                  {seller.branch && ` (${seller.branch})`}
                </p>
                {seller.address && <p>{seller.address}</p>}
                {seller.taxId && <p>เลขประจำตัวผู้เสียภาษี {seller.taxId}</p>}
                {seller.phone && <p>โทร. {seller.phone}</p>}

                <p className="mt-3 font-bold text-latte-deep">ลูกค้า</p>
                <p className="font-bold">
                  {buyer.name}
                  {buyer.branch && ` (${buyer.branch})`}
                </p>
                {buyer.address && <p className="whitespace-pre-line">{buyer.address}</p>}
                {buyer.taxId && <p>เลขประจำตัวผู้เสียภาษี {buyer.taxId}</p>}
                {inv.catName && <p className="text-[#777]">น้องแมว: {inv.catName}</p>}
              </div>
              <div>
                <p className="whitespace-nowrap pr-12 text-right text-lg font-bold text-latte-deep sm:text-xl">{title.th}</p>
                <p className="mb-2 pr-12 text-right text-[11px] text-[#999]">
                  {title.en} · {copy}
                </p>
                <dl className="grid grid-cols-[90px_1fr] gap-y-1 border-y border-[#e5e5e5] py-2">
                  <dt className="text-latte-deep">เลขที่</dt>
                  <dd>{docNo || "—"}</dd>
                  <dt className="text-latte-deep">วันที่</dt>
                  <dd>{dmy(docDate || new Date().toISOString())}</dd>
                  {kind === "quote" && (
                    <>
                      <dt className="text-latte-deep">ยืนราคาถึง</dt>
                      <dd>{dmy(addDays(docDate || new Date().toISOString(), 30))}</dd>
                    </>
                  )}
                  {kind === "invoice" && (
                    <>
                      <dt className="text-latte-deep">ครบกำหนด</dt>
                      <dd>{dmy(addDays(docDate || new Date().toISOString(), 7))}</dd>
                    </>
                  )}
                  <dt className="text-latte-deep">อ้างอิงบิล</dt>
                  <dd className="break-all">{inv.id.slice(-8).toUpperCase()}</dd>
                </dl>
                {buyer.phone && (
                  <dl className="grid grid-cols-[90px_1fr] border-b border-[#e5e5e5] py-2">
                    <dt className="text-latte-deep">เบอร์โทร</dt>
                    <dd>{buyer.phone}</dd>
                  </dl>
                )}
              </div>
            </header>

            {/* รายการ */}
            {/* จอมือถือ: เลื่อนตารางข้างได้ ไม่บีบชื่อรายการจนอ่านไม่ออก */}
            <div className="mt-5 overflow-x-auto print:overflow-visible">
            <table className="w-full min-w-[520px] border-collapse print:min-w-0">
              <thead>
                <tr className="border-y border-[#ccc] text-[11px]">
                  <th className="w-8 py-1.5 text-left font-bold">#</th>
                  <th className="py-1.5 text-left font-bold">รายละเอียด</th>
                  <th className="w-14 py-1.5 text-right font-bold">จำนวน</th>
                  <th className="w-24 py-1.5 text-right font-bold">ราคาต่อหน่วย</th>
                  <th className="w-24 py-1.5 text-right font-bold">มูลค่า</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it, idx) => {
                  const qty = it.qty || 1;
                  const unit = it.unitAmount ?? it.amount / qty;
                  return (
                    <tr key={idx} className="border-b border-[#eee] align-top">
                      <td className="py-1.5">{idx + 1}</td>
                      <td className="py-1.5">
                        {it.label}
                        {it.catName && <span className="text-[#888]"> · {it.catName}</span>}
                      </td>
                      <td className="py-1.5 text-right">{qty}</td>
                      <td className="py-1.5 text-right">{money(unit)}</td>
                      <td className="py-1.5 text-right">{money(it.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* ยอดรวม */}
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_280px] print:grid-cols-[1fr_280px]">
              <p className="self-end text-[11px] text-[#666]">({bahtText(inv.total)})</p>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-right">
                <dt className="text-latte-deep">รวมเงิน</dt>
                <dd>{money(inv.subtotal)} บาท</dd>
                {inv.discount > 0 && (
                  <>
                    <dt className="text-latte-deep">ส่วนลด{inv.promoLabel ? ` (${inv.promoLabel})` : ""}</dt>
                    <dd>-{money(inv.discount)} บาท</dd>
                  </>
                )}
                {vat && (
                  <>
                    <dt className="text-latte-deep">มูลค่าก่อนภาษี</dt>
                    <dd>{money(inv.total - vatAmount)} บาท</dd>
                    <dt className="text-latte-deep">ภาษีมูลค่าเพิ่ม {seller.vatRate}%</dt>
                    <dd>{money(vatAmount)} บาท</dd>
                  </>
                )}
                <dt className="font-bold text-latte-deep">จำนวนเงินรวมทั้งสิ้น</dt>
                <dd className="font-bold">{money(inv.total)} บาท</dd>
                {kind === "invoice" && inv.deposit > 0 && (
                  <>
                    <dt className="text-latte-deep">ชำระมัดจำแล้ว</dt>
                    <dd>-{money(inv.deposit)} บาท</dd>
                    <dt className="font-bold text-latte-deep">ยอดคงค้าง</dt>
                    <dd className="font-bold">{money(Math.max(0, inv.total - inv.deposit))} บาท</dd>
                  </>
                )}
              </dl>
            </div>

            {doc.note && (
              <div className="mt-4">
                <p className="text-latte-deep">หมายเหตุ</p>
                <p className="whitespace-pre-line">{doc.note}</p>
              </div>
            )}

            {kind !== "receipt" && data.payment.accountNumber && (
              <div className="mt-4 text-[11px]">
                <p className="text-latte-deep">ช่องทางชำระเงิน</p>
                <p>
                  โอนเข้าบัญชี {data.payment.bankName} เลขที่ {data.payment.accountNumber}
                  {data.payment.accountName && ` ชื่อบัญชี ${data.payment.accountName}`}
                </p>
              </div>
            )}

            {kind === "receipt" && (
              <div className="mt-8 border-t border-[#ccc] pt-2 text-[11px]">
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>การชำระเงินจะสมบูรณ์เมื่อบริษัทได้รับเงินเรียบร้อยแล้ว</span>
                  {(
                    [
                      ["cash", "เงินสด"],
                      ["transfer", "โอนเงิน"],
                      ["member_credit", "เครดิตสมาชิก"],
                    ] as const
                  ).map(([m, l]) => (
                    <span key={m} className="inline-flex items-center gap-1">
                      <span className="inline-flex h-3.5 w-3.5 items-center justify-center border border-[#555] text-[10px] leading-none">
                        {(inv.paymentMethod || "transfer") === m ? "✓" : ""}
                      </span>
                      {l}
                    </span>
                  ))}
                </p>
                <p className="mt-1 grid grid-cols-3 gap-2">
                  <span>ธนาคาร {inv.paymentMethod === "transfer" || !inv.paymentMethod ? data.payment.bankName : "-"}</span>
                  <span>วันที่ {dmy(inv.paidAt)}</span>
                  <span className="text-right">จำนวนเงิน {money(inv.total)}</span>
                </p>
              </div>
            )}

            {/* ลายเซ็น */}
            <div className="mt-10 grid grid-cols-2 gap-6 text-center text-[11px]">
              <div>
                <p className="mb-8 text-left">ในนาม {buyer.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border-t border-[#999] pt-1">{kind === "receipt" ? "ผู้จ่ายเงิน" : kind === "quote" ? "ผู้อนุมัติ" : "ผู้รับเอกสาร"}</div>
                  <div className="border-t border-[#999] pt-1">วันที่</div>
                </div>
              </div>
              <div>
                <p className="mb-8 text-right">ในนาม {seller.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border-t border-[#999] pt-1">{kind === "receipt" ? "ผู้รับเงิน" : kind === "quote" ? "ผู้เสนอราคา" : "ผู้ออกเอกสาร"}</div>
                  <div className="border-t border-[#999] pt-1">วันที่</div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {editBuyer && (
        <BuyerSheet
          initial={doc.buyer || data.suggestedBuyer}
          note={doc.note || ""}
          fallbackName={inv.customerName}
          onClose={() => setEditBuyer(false)}
          onSave={async (b, note) => {
            const res = await fetch("/api/invoice-docs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ invoiceId: inv.id, buyer: b, note }),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) {
              toast("บันทึกไม่สำเร็จ", "error");
              return;
            }
            setData((cur) => (cur ? { ...cur, doc: d.doc || cur.doc } : cur));
            setEditBuyer(false);
            toast("บันทึกข้อมูลผู้ซื้อแล้ว", "success");
          }}
        />
      )}
    </div>
  );
}

function BuyerSheet({
  initial,
  note: initialNote,
  fallbackName,
  onClose,
  onSave,
}: {
  initial?: Buyer;
  note: string;
  fallbackName: string;
  onClose: () => void;
  onSave: (b: Buyer | null, note: string) => void;
}) {
  const [b, setB] = useState<Buyer>(initial || { name: "", branch: "สำนักงานใหญ่" });
  const [note, setNote] = useState(initialNote);
  const field = "mt-1 min-h-[44px] w-full rounded-xl border border-catcha-line bg-paper px-3 py-2 text-sm";
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4 print:hidden" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-catcha bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-catcha sm:rounded-catcha"
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Bill to</p>
            <p className="text-base font-extrabold text-catcha-chocolate">ออกในนามบริษัท / นิติบุคคล</p>
          </div>
          <button type="button" aria-label="ปิด" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-paper text-brown">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-brown-soft">
            ชื่อบริษัท / ผู้ซื้อ
            <input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder={`เช่น บริษัท ตัวอย่าง จำกัด (ไม่ใส่ = ${fallbackName})`} className={field} />
          </label>
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <label className="block text-xs font-bold text-brown-soft">
              เลขประจำตัวผู้เสียภาษี
              <input
                value={b.taxId || ""}
                inputMode="numeric"
                onChange={(e) => setB({ ...b, taxId: e.target.value.replace(/[^0-9-]/g, "").slice(0, 17) })}
                placeholder="13 หลัก"
                className={field}
              />
            </label>
            <label className="block text-xs font-bold text-brown-soft">
              สาขา
              <input value={b.branch || ""} onChange={(e) => setB({ ...b, branch: e.target.value })} placeholder="สำนักงานใหญ่" className={field} />
            </label>
          </div>
          <label className="block text-xs font-bold text-brown-soft">
            ที่อยู่ตามทะเบียน
            <textarea value={b.address || ""} onChange={(e) => setB({ ...b, address: e.target.value })} rows={3} className={field} />
          </label>
          <label className="block text-xs font-bold text-brown-soft">
            เบอร์โทร
            <input value={b.phone || ""} inputMode="tel" onChange={(e) => setB({ ...b, phone: e.target.value })} className={field} />
          </label>
          <label className="block text-xs font-bold text-brown-soft">
            หมายเหตุบนเอกสาร
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="เช่น ค่าฝากเลี้ยงเดือนตุลาคม" className={field} />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
          {initial && (
            <button
              type="button"
              onClick={() => onSave(null, note)}
              className="min-h-[48px] rounded-full bg-paper px-4 text-sm font-bold text-brown"
            >
              ใช้ชื่อลูกค้า
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(b.name.trim() ? b : null, note)}
            className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-full bg-catcha-chocolate text-sm font-extrabold text-card ${initial ? "" : "col-span-2"}`}
          >
            <Icon name="check" size={16} strokeWidth={2.4} />
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
