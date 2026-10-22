/**
 * สรุปจำนวนแมวรายเดือน — เดือนนี้อาบน้ำกี่ตัว เข้าพักกี่ตัว
 * นัด 1 แถว = แมว 1 ตัว จึงนับจากนัดได้ตรง ๆ (ไม่นับนัดที่ยกเลิก/ไม่มา)
 * ฟังก์ชันล้วน ใช้ได้ทั้งหน้าเว็บและทดสอบ
 */
import { isDayCareStay } from "./day-care";

export type CountBooking = {
  customerId?: string;
  customerName?: string;
  catName?: string;
  service: "groom" | "room" | string;
  status: string;
  date?: string;
  checkin?: string;
  checkout?: string;
};

export type MonthCatCounts = {
  month: string;
  /** อาบน้ำ: จำนวนครั้ง (1 นัด = 1 ตัว) ทั้งเดือน / มาแล้ว / ยังไม่ถึงวัน */
  bath: { total: number; done: number; upcoming: number; houses: number };
  /** เข้าพักค้างคืนที่มีคืนอยู่ในเดือนนี้ */
  stay: { total: number; done: number; upcoming: number; houses: number; nights: number };
  /** Day Care (เข้า-ออกวันเดียว) แยกไว้ ไม่ปนกับเข้าพัก */
  dayCare: { total: number; done: number; upcoming: number };
};

const SKIP = new Set(["cancelled", "no_show"]);
const DAY = 86400000;
const day = (s?: string) => (s || "").slice(0, 10);
const toMs = (s: string) => new Date(`${s}T00:00:00Z`).getTime();

export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { first: `${y}-${mm}-01`, last: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** เลื่อนเดือน เช่น shiftMonth("2026-01", -1) = "2025-12" */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const houseKey = (b: CountBooking) => b.customerId || (b.customerName || "").trim();

/**
 * @param month YYYY-MM
 * @param today YYYY-MM-DD (เวลาไทย) — ใช้แยก "มาแล้ว" กับ "นัดล่วงหน้า"
 */
export function monthCatCounts(bookings: CountBooking[], month: string, today: string): MonthCatCounts {
  const { first, last } = monthBounds(month);
  const out: MonthCatCounts = {
    month,
    bath: { total: 0, done: 0, upcoming: 0, houses: 0 },
    stay: { total: 0, done: 0, upcoming: 0, houses: 0, nights: 0 },
    dayCare: { total: 0, done: 0, upcoming: 0 },
  };
  const bathHouses = new Set<string>();
  const stayHouses = new Set<string>();

  for (const b of bookings) {
    if (SKIP.has(b.status)) continue;
    if (b.service === "groom") {
      const d = day(b.date);
      if (!d || d < first || d > last) continue;
      out.bath.total++;
      if (d <= today) out.bath.done++;
      else out.bath.upcoming++;
      bathHouses.add(houseKey(b));
      continue;
    }
    if (b.service !== "room") continue;
    const ci = day(b.checkin || b.date);
    if (!ci) continue;
    if (isDayCareStay({ service: "room", checkin: ci, checkout: b.checkout })) {
      if (ci < first || ci > last) continue;
      out.dayCare.total++;
      if (ci <= today) out.dayCare.done++;
      else out.dayCare.upcoming++;
      continue;
    }
    // คืนที่พัก = วันเข้า … วันก่อนวันออก — นับตัวที่มีคืนตกอยู่ในเดือนนี้
    const co = day(b.checkout) || ci;
    const lastNight = co > ci ? new Date(toMs(co) - DAY).toISOString().slice(0, 10) : ci;
    if (lastNight < first || ci > last) continue;
    const from = ci > first ? ci : first;
    const to = lastNight < last ? lastNight : last;
    out.stay.total++;
    out.stay.nights += Math.round((toMs(to) - toMs(from)) / DAY) + 1;
    if (ci <= today) out.stay.done++;
    else out.stay.upcoming++;
    stayHouses.add(houseKey(b));
  }
  out.bath.houses = bathHouses.size;
  out.stay.houses = stayHouses.size;
  return out;
}
