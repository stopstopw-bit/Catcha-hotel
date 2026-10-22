"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { bangkokToday } from "@/lib/bangkok-date";
import { monthCatCounts, shiftMonth, type CountBooking } from "@/lib/monthly-cat-counts";

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${THAI_MONTHS[m - 1]} ${y}`;
};

function BigTile({
  icon,
  tint,
  label,
  value,
  sub,
}: {
  icon: string;
  tint: string;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="rounded-catcha-sm bg-paper p-3.5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tint} text-catcha-chocolate`}>
        <Icon name={icon} size={18} />
      </span>
      <p className="mt-2 text-[11px] font-bold text-brown-soft">{label}</p>
      <p className="text-3xl font-extrabold leading-tight text-catcha-chocolate">
        {value.toLocaleString()}
        <span className="ml-1 text-sm font-bold text-brown-soft">ตัว</span>
      </p>
      <p className="mt-0.5 text-[10px] text-brown-faint">{sub}</p>
    </div>
  );
}

/** สรุปรายเดือน: อาบน้ำกี่ตัว เข้าพักกี่ตัว — เลื่อนดูเดือนอื่นได้ + ย้อนหลัง 6 เดือน */
export function MonthlyCatCounts({ bookings }: { bookings: CountBooking[] }) {
  const today = bangkokToday();
  const thisMonth = today.slice(0, 7);
  const [month, setMonth] = useState(thisMonth);

  const c = useMemo(() => monthCatCounts(bookings, month, today), [bookings, month, today]);
  const trend = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((m) =>
        monthCatCounts(bookings, m, today)
      ),
    [bookings, month, today]
  );
  const isPast = month < thisMonth;
  const isFuture = month > thisMonth;
  const split = (done: number, upcoming: number) =>
    isPast || !upcoming ? "" : isFuture ? " · ยังไม่ถึงวัน" : ` · มาแล้ว ${done} · นัดอีก ${upcoming}`;

  return (
    <section className="rounded-catcha bg-card p-4 shadow-catcha-sm">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 text-sm font-extrabold text-catcha-chocolate">สรุปจำนวนน้องรายเดือน</h2>
        <button
          type="button"
          aria-label="เดือนก่อน"
          onClick={() => setMonth(shiftMonth(month, -1))}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper text-latte-deep"
        >
          <span className="flex rotate-180">
            <Icon name="chevron" size={16} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMonth(thisMonth)}
          className="min-w-[84px] text-center text-sm font-extrabold text-latte-deep"
        >
          {month === thisMonth ? "เดือนนี้" : monthLabel(month)}
        </button>
        <button
          type="button"
          aria-label="เดือนถัดไป"
          onClick={() => setMonth(shiftMonth(month, 1))}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-paper text-latte-deep"
        >
          <Icon name="chevron" size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <BigTile
          icon="bath"
          tint="bg-honey/30"
          label="อาบน้ำ"
          value={c.bath.total}
          sub={`${c.bath.houses} บ้าน${split(c.bath.done, c.bath.upcoming)}`}
        />
        <BigTile
          icon="bed"
          tint="bg-sage/30"
          label="เข้าพัก"
          value={c.stay.total}
          sub={`${c.stay.houses} บ้าน · ${c.stay.nights} คืน${split(c.stay.done, c.stay.upcoming)}`}
        />
      </div>
      {c.dayCare.total > 0 && (
        <p className="mt-2 rounded-catcha-sm bg-paper px-3 py-2 text-xs font-bold text-brown">
          Day Care {c.dayCare.total} ตัว
          <span className="font-normal text-brown-faint">{split(c.dayCare.done, c.dayCare.upcoming)}</span>
        </p>
      )}

      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-[10px] text-brown-faint">
            <th className="py-1 text-left font-bold">ย้อนหลัง 6 เดือน</th>
            <th className="py-1 text-right font-bold">อาบน้ำ</th>
            <th className="py-1 text-right font-bold">เข้าพัก</th>
            <th className="py-1 text-right font-bold">Day Care</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-catcha-line">
          {trend.map((t) => (
            <tr
              key={t.month}
              onClick={() => setMonth(t.month)}
              className={`cursor-pointer ${t.month === month ? "font-extrabold text-catcha-chocolate" : "text-brown"}`}
            >
              <td className="py-1.5">{monthLabel(t.month)}</td>
              <td className="py-1.5 text-right">{t.bath.total}</td>
              <td className="py-1.5 text-right">{t.stay.total}</td>
              <td className="py-1.5 text-right">{t.dayCare.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[10px] text-brown-faint">
        นับเป็นตัว (1 นัด = 1 ตัว) ไม่รวมนัดที่ยกเลิก/ไม่มา · เข้าพักนับตัวที่มีคืนพักอยู่ในเดือนนั้น
        (พักข้ามเดือนนับทั้งสองเดือน) · คืน = จำนวนคืนต่อตัวรวมกันเฉพาะในเดือนนั้น
      </p>
    </section>
  );
}
