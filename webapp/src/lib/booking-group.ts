/**
 * รวมนัดของ "บ้านเดียวกัน นัดเดียวกัน" เข้าเป็นกลุ่มเดียว
 *
 * ระบบเก็บนัดเป็น 1 แถวต่อ 1 ตัว (เพราะแต่ละตัวมีประวัติ/บริการของตัวเอง)
 * แต่เวลาแสดงผลและตอนคิดเงิน เจ้าของคนเดียวพาแมวมา 7 ตัวในวันเดียว
 * ควรเห็นเป็น "1 นัด 7 ตัว" และออกบิลใบเดียว
 *
 * คนละวัน / คนละบริการ = คนละกลุ่มเสมอ (ตรงตามที่ร้านใช้งานจริง:
 * ถ้าแยกวันกันมา ก็ลงนัดตามชื่อแมวที่มาวันนั้น)
 */

export type GroupableBooking = {
  id: string;
  customerId?: string;
  customerName: string;
  catName: string;
  service?: string;
  date?: string;
  time?: string;
  checkin?: string;
  checkout?: string;
};

/** กุญแจจัดกลุ่ม — ลูกค้าคนเดียวกัน บริการเดียวกัน และช่วงเวลาตรงกันทุกช่อง */
export function bookingGroupKey(b: GroupableBooking) {
  return [
    b.customerId || b.customerName,
    b.service || "",
    b.date || "",
    b.time || "",
    b.checkin || "",
    b.checkout || "",
  ].join("|");
}

/** จัดกลุ่มโดยคงลำดับเดิมของรายการแรกในแต่ละกลุ่มไว้ */
export function groupBookings<T extends GroupableBooking>(list: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const b of list) {
    const k = bookingGroupKey(b);
    const arr = groups.get(k);
    if (arr) arr.push(b);
    else groups.set(k, [b]);
  }
  return Array.from(groups.values());
}

/** ชื่อแมวทุกตัวในกลุ่ม เช่น "ลาล่า, บาซ่า, ซิมบ้า" */
export function groupCatNames(group: GroupableBooking[]) {
  return group.map((b) => b.catName).join(", ");
}

/**
 * จัดกลุ่มตอน "ออกบิล" — 1 บ้าน = 1 บิล
 *
 * กว้างกว่า groupBookings: น้องในบ้านเดียวกันที่พักช่วงเหลื่อมกัน (เข้า/ออกไม่ตรงวันกันก็ได้)
 * หรืออาบน้ำวันเดียวกัน (คนละเวลา) รวมเป็นบิลใบเดียว
 * ไม่งั้นน้องที่ต่อคืนไม่เท่ากันจะแตกเป็นหลายบิล แล้วหน้าประวัติดูเหมือนบิลซ้ำ
 */
export function groupForBilling<T extends GroupableBooking>(list: T[]): T[][] {
  const day = (s?: string) => (s || "").slice(0, 10);
  const byHouse = new Map<string, T[]>();
  for (const b of list) {
    const k = [b.customerId || b.customerName, b.service || ""].join("|");
    byHouse.set(k, [...(byHouse.get(k) || []), b]);
  }
  const out: T[][] = [];
  for (const house of byHouse.values()) {
    const isStay = (b: T) => !!(b.checkin && b.checkout);
    const stays = house.filter(isStay).sort((a, b) => day(a.checkin).localeCompare(day(b.checkin)));
    // ช่วงพักที่เหลื่อมกัน (เข้าก่อนอีกตัวออก) = การมาพักครั้งเดียวกันของบ้านนี้
    // Day Care (เข้า-ออกวันเดียวกัน) ใช้ห้องทั้งวันนั้น — ปลายช่วงเป็น "ท้ายวันเข้า" ไม่ใช่ช่วงว่าง
    const endOf = (b: T) => (day(b.checkout) > day(b.checkin) ? day(b.checkout) : `${day(b.checkin)}~`);
    let cur: T[] = [];
    let curEnd = "";
    for (const b of stays) {
      if (cur.length && day(b.checkin) < curEnd) {
        cur.push(b);
        if (endOf(b) > curEnd) curEnd = endOf(b);
      } else {
        if (cur.length) out.push(cur);
        cur = [b];
        curEnd = endOf(b);
      }
    }
    if (cur.length) out.push(cur);
    // อาบน้ำ/บริการรายวัน: วันเดียวกัน = บิลเดียว (คนละเวลาก็ได้)
    const byDay = new Map<string, T[]>();
    for (const b of house.filter((x) => !isStay(x))) {
      const k = day(b.date || b.checkin);
      byDay.set(k, [...(byDay.get(k) || []), b]);
    }
    out.push(...byDay.values());
  }
  return out;
}
