"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { EmptyState, MoreMenu, Segmented } from "@/components/ui";
import { toast } from "@/components/Toast";
import { BuyerSheet } from "@/components/BuyerSheet";
import {
  DocPdfButton,
  InvoiceDocument,
  docNumberOf,
  money,
  type Data,
  type Kind,
} from "@/components/InvoiceDocument";

/**
 * เอกสารทางการจากบิล — ใบเสนอราคา / ใบแจ้งหนี้ / ใบเสร็จรับเงิน (ใบกำกับภาษีถ้าร้านจด VAT)
 * ออกในนามบริษัทได้ (ชื่อ ที่อยู่ เลขผู้เสียภาษี สาขาของผู้ซื้อ) · ส่งทาง LINE · บันทึก PDF · พิมพ์
 * เลขที่เอกสารออกตอนส่ง/บันทึก/พิมพ์ครั้งแรก แล้วคงที่ (ออกซ้ำได้เลขเดิม)
 */


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
  const docNo = docNumberOf(doc, kind);
  const backHref = search.get("from") === "docs" ? "/admin/billing/docs" : "/admin/billing";

  /** ออกเลขที่ก่อน (ครั้งแรก) — ส่ง/บันทึก/พิมพ์ทุกทางต้องมีเลขที่บนเอกสาร */
  const ensureNumber = async (): Promise<Data | null> => {
    if (!data || !inv) return null;
    if (docNo) return data;
    const res = await fetch("/api/invoice-docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: inv.id, issue: kind }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(d.error === "not_paid" ? "ออกใบเสร็จได้หลังรับเงินแล้วเท่านั้น" : "ออกเลขที่เอกสารไม่สำเร็จ", "error");
      return null;
    }
    const next = { ...data, doc: d.doc };
    setData(next);
    return next;
  };

  const saveBuyer = async (payload: Record<string, unknown>) => {
    if (!inv) return;
    const res = await fetch("/api/invoice-docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: inv.id, ...payload }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast("บันทึกไม่สำเร็จ", "error");
      return;
    }
    setData((cur) => (cur ? { ...cur, doc: d.doc || cur.doc, fromProfile: false } : cur));
    setEditBuyer(false);
    toast(payload.remember ? "บันทึกแล้ว และจำไว้ใช้กับบิลถัดไป" : "บันทึกข้อมูลผู้ซื้อแล้ว", "success");
  };

  const print = async () => {
    setBusy(true);
    const ok = await ensureNumber();
    setBusy(false);
    // รอให้เลขที่ขึ้นบนหน้าก่อนเปิดหน้าต่างพิมพ์
    if (ok) setTimeout(() => window.print(), 150);
  };

  const sendLine = async () => {
    if (!inv) return;
    setBusy(true);
    const res = await fetch("/api/invoice-docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: inv.id, send: kind }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (d.doc) setData((cur) => (cur ? { ...cur, doc: d.doc } : cur));
    if (res.ok) return toast("ส่งเอกสารให้ลูกค้าทาง LINE แล้ว", "success");
    toast(
      d.error === "no_line"
        ? "ลูกค้ายังไม่ได้ผูก LINE — ใช้ ⋯ › คัดลอกลิงก์ แล้วส่งเองได้"
        : d.error === "not_paid"
          ? "ออกใบเสร็จได้หลังรับเงินแล้วเท่านั้น"
          : d.error === "line_failed"
            ? "ส่ง LINE ไม่สำเร็จ — ลองคัดลอกลิงก์ส่งเองแทน"
            : "ส่งไม่สำเร็จ",
      "error"
    );
  };

  const copyLink = async () => {
    if (!inv) return;
    setBusy(true);
    const res = await fetch("/api/invoice-docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: inv.id, link: kind }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !d.url) {
      toast(d.error === "not_paid" ? "ออกใบเสร็จได้หลังรับเงินแล้วเท่านั้น" : "สร้างลิงก์ไม่สำเร็จ", "error");
      return;
    }
    setData((cur) => (cur ? { ...cur, doc: d.doc } : cur));
    try {
      await navigator.clipboard.writeText(d.url);
      toast("คัดลอกลิงก์เอกสารแล้ว ส่งให้ลูกค้าได้เลย", "success");
    } catch {
      window.prompt("คัดลอกลิงก์นี้ไปส่งให้ลูกค้า", d.url);
    }
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

  const copies = kind === "receipt" && withCopy ? (["ต้นฉบับ", "สำเนา"] as const) : (["ต้นฉบับ"] as const);
  const btn = "flex min-h-[48px] items-center justify-center gap-1.5 rounded-full text-sm font-extrabold disabled:opacity-50";

  return (
    <div>
      {/* แถบเครื่องมือ (ไม่พิมพ์) */}
      <div className="mb-4 space-y-3 print:hidden">
        <div className="flex items-center gap-2">
          <Link href={backHref} aria-label="กลับ" className="flex h-10 w-10 items-center justify-center rounded-full bg-paper text-brown">
            <Icon name="back" size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Documents</p>
            <p className="truncate text-sm font-extrabold text-catcha-chocolate">
              {inv.customerName} · {money(inv.total)} ฿
            </p>
          </div>
          <MoreMenu
            items={[
              { label: "พิมพ์", icon: "receipt", onClick: print, disabled: busy },
              { label: "คัดลอกลิงก์ให้ลูกค้า", icon: "link", onClick: copyLink, disabled: busy },
              { label: "เอกสารที่ออกแล้วทั้งหมด", icon: "inbox", onClick: () => window.open("/admin/billing/docs", "_self") },
            ]}
          />
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
                ? [data.fromProfile && "ข้อมูลที่จำไว้ของลูกค้า", doc.buyer.taxId && `เลขผู้เสียภาษี ${doc.buyer.taxId}`, doc.buyer.branch]
                    .filter(Boolean)
                    .join(" · ") || "แตะเพื่อแก้ไข"
                : data.suggestedBuyer
                  ? `ใช้ข้อมูลครั้งก่อนได้: ${data.suggestedBuyer.name}`
                  : "ใส่ชื่อบริษัท ที่อยู่ เลขผู้เสียภาษี — ไม่ใส่ = ออกในชื่อลูกค้า"}
            </span>
          </span>
          <Icon name="chevron" size={16} className="text-brown-faint" />
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-brown-soft">
          <span>
            เลขที่: <b className="text-brown">{docNo || "ออกให้อัตโนมัติเมื่อส่ง / บันทึก / พิมพ์"}</b>
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
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={sendLine}
            disabled={busy}
            className={`${btn} ${data.hasLine ? "bg-catcha-chocolate text-card" : "bg-paper text-brown-soft"}`}
          >
            <Icon name="send" size={16} />
            ส่งทาง LINE
          </button>
          <DocPdfButton
            data={data}
            kind={kind}
            copies={copies}
            prepare={ensureNumber}
            className={`${btn} border border-catcha-line bg-card text-catcha-chocolate`}
          />
        </div>
        {!data.hasLine && (
          <p className="text-center text-[11px] text-brown-soft">ลูกค้ายังไม่ผูก LINE — บันทึก PDF แล้วส่งเอง หรือใช้ ⋯ › คัดลอกลิงก์</p>
        )}
      </div>

      <InvoiceDocument data={data} kind={kind} copies={copies} />

      {editBuyer && (
        <BuyerSheet
          initial={doc.buyer || data.suggestedBuyer}
          note={doc.note || ""}
          fallbackName={inv.customerName}
          onClose={() => setEditBuyer(false)}
          onSave={(b, note, remember) => saveBuyer({ buyer: b, note, remember })}
          onUseCustomer={doc.buyer ? (remember) => saveBuyer({ useCustomer: true, note: doc.note || "", remember }) : undefined}
        />
      )}
    </div>
  );
}
