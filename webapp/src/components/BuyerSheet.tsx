"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

export type Buyer = { name: string; taxId?: string; branch?: string; address?: string; phone?: string };

/**
 * แผ่นกรอกข้อมูลผู้ซื้อบนเอกสาร (ในนามบริษัท / นิติบุคคล)
 * mode "bill": ตั้งเฉพาะบิลนี้ + ติ๊ก "จำไว้" เพื่อใช้กับบิลถัดไปของลูกค้าคนนี้
 * mode "profile": แก้ข้อมูลออกบิลที่จำไว้ของลูกค้า (จากหน้าลูกค้า)
 */
export function BuyerSheet({
  initial,
  note: initialNote,
  fallbackName,
  mode = "bill",
  rememberDefault = true,
  onClose,
  onSave,
  onUseCustomer,
}: {
  initial?: Buyer;
  note?: string;
  fallbackName: string;
  mode?: "bill" | "profile";
  rememberDefault?: boolean;
  onClose: () => void;
  onSave: (b: Buyer | null, note: string, remember: boolean) => void;
  /** ปุ่มรอง: ออกในชื่อลูกค้า (bill) / ลบข้อมูลที่จำไว้ (profile) */
  onUseCustomer?: (remember: boolean) => void;
}) {
  const [b, setB] = useState<Buyer>(initial || { name: "", branch: "สำนักงานใหญ่" });
  const [note, setNote] = useState(initialNote || "");
  const [remember, setRemember] = useState(rememberDefault);
  const field = "mt-1 min-h-[44px] w-full rounded-xl border border-catcha-line bg-paper px-3 py-2 text-sm";
  const bill = mode === "bill";
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4 print:hidden" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-catcha bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-catcha sm:rounded-catcha"
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Bill to</p>
            <p className="text-base font-extrabold text-catcha-chocolate">
              {bill ? "ออกในนามบริษัท / นิติบุคคล" : `ข้อมูลออกบิลของ ${fallbackName}`}
            </p>
          </div>
          <button type="button" aria-label="ปิด" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-paper text-brown">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="space-y-2.5">
          <label className="block text-xs font-bold text-brown-soft">
            ชื่อบริษัท / ผู้ซื้อ
            <input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="เช่น บริษัท ตัวอย่าง จำกัด" className={field} />
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
          {bill && (
            <label className="block text-xs font-bold text-brown-soft">
              หมายเหตุบนเอกสาร
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="เช่น ค่าฝากเลี้ยงเดือนตุลาคม" className={field} />
            </label>
          )}
          {bill && (
            <label className="flex min-h-[44px] items-center gap-2 rounded-xl bg-honey/20 px-3 text-xs font-bold text-catcha-chocolate">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-latte-deep" />
              จำไว้ ใช้กับบิลถัดไปของลูกค้าคนนี้อัตโนมัติ
            </label>
          )}
        </div>
        <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
          {onUseCustomer && (
            <button
              type="button"
              onClick={() => onUseCustomer(remember)}
              className="min-h-[48px] rounded-full bg-paper px-4 text-sm font-bold text-brown"
            >
              {bill ? "ใช้ชื่อลูกค้า" : "ลบข้อมูล"}
            </button>
          )}
          <button
            type="button"
            onClick={() => onSave(b.name.trim() ? b : null, note, remember)}
            className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-full bg-catcha-chocolate text-sm font-extrabold text-card ${onUseCustomer ? "" : "col-span-2"}`}
          >
            <Icon name="check" size={16} strokeWidth={2.4} />
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
