"use client";

import { useEffect, useState } from "react";
import { useLiff } from "@/components/LiffProvider";
import { customerFetch } from "@/lib/customer-fetch";
import { thaiDateRange } from "@/lib/service-history-rows";
import { useL } from "@/components/LocaleProvider";
import { dateRangeFor } from "@/lib/locale-date";

type CourseUse = {
  /** วันที่หัก (วันจ่ายบิล) */
  date: string;
  units: number;
  checkin?: string;
  checkout?: string;
  catName?: string;
};

type CustomerPackage = {
  id: string;
  name: string;
  totalUses: number;
  usedUses: number;
  status: "active" | "done" | "cancelled";
  /** คืน = คอร์สวันพัก (ไม่ระบุ = ครั้ง) */
  unit?: "use" | "night";
  /** "ห้อง Mid Cozy" — คอร์สวันพักที่ผูกห้อง */
  roomLabel?: string;
  createdAt?: string;
  /** แบ่งจ่ายยังไม่ครบ — ยังใช้ไม่ได้ */
  locked?: boolean;
  outstanding?: number;
  uses?: CourseUse[];
};

/** คอร์สที่ขายในบิลแต่บิลยังจ่ายไม่ครบ — ยังไม่ได้คอร์ส */
type PendingCourse = {
  invoiceId: string;
  name: string;
  amount: number;
  remaining: number;
  detail: string;
};

/** 2026-11-11 → 11 พ.ย. 2026 (ปี ค.ศ. ให้ตรงกับบิล) · อังกฤษ 11 Nov 2026 */
function thaiDate(d?: string, en = false) {
  if (!d) return "";
  const dt = new Date(`${d.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(en ? "en-GB" : "th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    calendar: "gregory",
  });
}

function describeUse(u: CourseUse, unit: string, en = false) {
  const amount = `${u.units} ${unit}`;
  if (u.checkin && u.checkout) {
    return {
      main: en ? `Stay ${dateRangeFor(u.checkin, u.checkout, true)}` : `เข้าพัก ${thaiDateRange(u.checkin, u.checkout)}`,
      amount,
    };
  }
  return { main: en ? `Used on ${thaiDate(u.date, true)}` : `ใช้วันที่ ${thaiDate(u.date)}`, amount };
}

/**
 * คอร์ส/แพ็กเกจที่ลูกค้าซื้อไว้ — ลูกค้าจ่ายเงินล่วงหน้าแล้ว ต้องเปิดดูเองได้ว่าเหลือเท่าไหร่ ใช้ไปตอนไหน
 * - คอร์สที่ใช้ครบแล้วยังโชว์อยู่สักพัก (เช่น ซื้อ 30 คืนแล้วพักรวดเดียว 30 คืน — ถ้าหายไปเลยลูกค้าจะงงว่าคอร์สไปไหน)
 * - คอร์สที่อยู่ในบิลที่ยังจ่ายไม่ครบ โชว์เป็น "รอชำระ"
 * ไม่มีอะไรเลย = ซ่อนทั้งช่อง (ไม่ต้องรกหน้าแรก)
 */
export function MyPackagesSection({
  onChecked,
}: {
  /** บอกหน้าแม่ว่าเช็คเสร็จแล้วและมีคอร์สไหม — ใช้ตัดสินใจว่าจะโชว์ช่องแต้มไหม */
  onChecked?: (hasPackages: boolean) => void;
}) {
  const { profile } = useLiff();
  const { L, en } = useL();
  const [packages, setPackages] = useState<CustomerPackage[]>([]);
  const [pending, setPending] = useState<PendingCourse[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.lineUserId) return;
    let alive = true;
    customerFetch(
      `/api/packages?lineUserId=${encodeURIComponent(profile.lineUserId)}&view=mine`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const list: CustomerPackage[] = d.packages || [];
        const wait: PendingCourse[] = d.pending || [];
        setPackages(list);
        setPending(wait);
        onChecked?.(list.length + wait.length > 0);
      })
      .catch(() => {
        if (alive) onChecked?.(false);
      });
    return () => {
      alive = false;
    };
    // onChecked ตั้งใจไม่ใส่ใน deps — หน้าแม่ส่ง setState มาตรงๆ ใส่แล้วจะวนไม่จบ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.lineUserId]);

  if (packages.length === 0 && pending.length === 0) return null;

  // ใช้ได้อยู่ขึ้นก่อน คอร์สที่ใช้ครบแล้วไว้ท้าย
  const sorted = [...packages].sort((a, b) => {
    const da = a.usedUses >= a.totalUses ? 1 : 0;
    const db = b.usedUses >= b.totalUses ? 1 : 0;
    return da - db;
  });

  return (
    <section className="mb-4 rounded-catcha border-2 border-latte/50 bg-gradient-to-br from-latte/20 via-card to-honey/10 p-4 shadow-catcha">
      <p className="mb-2 text-sm font-extrabold text-catcha-chocolate">🎫 {L("คอร์สของฉัน", "My packages")}</p>
      <div className="space-y-2">
        {pending.map((c) => (
          <div
            key={`${c.invoiceId}-${c.name}`}
            className="rounded-catcha-sm border border-wait/40 bg-card/80 px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-extrabold text-brown">{c.name}</p>
              <span className="shrink-0 rounded-full bg-honey/30 px-2 py-0.5 text-[10px] font-bold text-wait">
                {L("รอชำระ", "Awaiting payment")}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-brown-soft">
              {c.detail}
              {c.remaining > 0 && L(` · ค้าง ${Math.round(c.remaining).toLocaleString()} บาท`, ` · ${Math.round(c.remaining).toLocaleString()} THB outstanding`)}
            </p>
            <p className="mt-1 text-[10px] text-brown-faint">
              {L("จ่ายครบแล้วคอร์สจะเข้าบัญชีให้อัตโนมัติค่ะ", "The package is added automatically once fully paid.")}
            </p>
          </div>
        ))}

        {sorted.map((p) => {
          const left = Math.max(0, p.totalUses - p.usedUses);
          const usedUp = left === 0;
          const unit = p.unit === "night" ? L("คืน", "nights") : L("ครั้ง", "uses");
          const usedPct = p.totalUses > 0 ? Math.min(100, (p.usedUses / p.totalUses) * 100) : 0;
          const uses = p.uses || [];
          const isOpen = open === p.id;
          return (
            <div
              key={p.id}
              className={`rounded-catcha-sm bg-card/80 px-3 py-2.5 ${usedUp ? "opacity-75" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-extrabold text-brown">{p.name}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    p.locked
                      ? "bg-honey/30 text-wait"
                      : usedUp
                        ? "bg-paper text-brown-faint"
                        : "bg-sage/30 text-ok"
                  }`}
                >
                  {p.locked ? L("🔒 รอจ่ายครบ", "🔒 Awaiting full payment") : usedUp ? L("ใช้ครบแล้ว", "Used up") : L("ใช้ได้", "Active")}
                </span>
              </div>

              <div className="mt-1.5 flex items-end justify-between gap-2">
                <p className="text-2xl font-extrabold leading-none text-latte-deep">
                  {left}
                  <span className="ml-1 text-xs font-bold text-brown-faint">
                    / {p.totalUses} {unit} {L("เหลือ", "left")}
                  </span>
                </p>
                <p className="text-[11px] font-bold text-brown-soft">
                  {L("ใช้ไป", "Used")} {p.usedUses} {unit}
                </p>
              </div>

              {/* แถบแสดงว่าใช้ไปเท่าไหร่แล้ว — เห็นภาพเร็วกว่าตัวเลขอย่างเดียว */}
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper">
                <div
                  className="h-full rounded-full bg-latte-deep transition-all"
                  style={{ width: `${usedPct}%` }}
                />
              </div>

              <p className="mt-1.5 text-[11px] leading-relaxed text-brown-soft">
                {p.roomLabel && <>{en ? `For ${p.roomLabel.replace(/^ห้อง\s*/, "")} room` : `ใช้กับ${p.roomLabel}`} · </>}
                {p.createdAt && <>{L("ซื้อเมื่อ", "Bought")} {thaiDate(p.createdAt, en)}</>}
                {p.unit === "night" && <> · {L("ไม่มีวันหมดอายุ", "never expires")}</>}
              </p>
              {p.locked && (
                <p className="mt-0.5 text-[11px] font-bold text-wait">
                  {L("ใช้ได้เมื่อจ่ายครบ (ค้าง", "Usable once fully paid (")} {Math.round(p.outstanding || 0).toLocaleString()} {L("บาท)", "THB outstanding)")}
                </p>
              )}

              {uses.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : p.id)}
                    aria-expanded={isOpen}
                    className="mt-2 w-full rounded-catcha-sm border border-catcha-line bg-card/70 px-3 py-1.5 text-[11px] font-bold text-latte-deep active:scale-[0.99]"
                  >
                    {isOpen ? L("ซ่อนประวัติการใช้ ▲", "Hide usage history ▲") : L(`ดูประวัติการใช้ (${uses.length}) ▼`, `View usage history (${uses.length}) ▼`)}
                  </button>
                  {isOpen && (
                    <ul className="mt-1.5 divide-y divide-catcha-line overflow-hidden rounded-catcha-sm border border-catcha-line bg-card text-[11px]">
                      {uses.map((u, i) => {
                        const l = describeUse(u, unit, en);
                        return (
                          <li key={i} className="flex items-center justify-between gap-2 px-3 py-2">
                            <span className="min-w-0">
                              <span className="block font-bold text-brown">{l.main}</span>
                              {u.catName && (
                                <span className="block truncate text-[10px] text-brown-faint">
                                  {u.catName}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-extrabold text-latte-deep">−{l.amount}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-brown-faint">
        {L("ใช้ได้เลยตอนมาใช้บริการ — แจ้งร้านได้ว่าจะหักจากคอร์สนะคะ 🧡", "Use it at your next visit — just tell us to deduct from your package 🧡")}
      </p>
    </section>
  );
}
