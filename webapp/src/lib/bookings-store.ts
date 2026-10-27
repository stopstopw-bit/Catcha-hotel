import type { Booking, BookingStatus } from "./business";
import { getSupabase, selectAllRows } from "./supabase/server";
import { uploadDataUrlToStorage } from "./supabase/storage";
import { seedEnabled } from "./demo-seed";
import type { BookingTransport } from "./transport";
import type { RoomSegment } from "./room-segments";
import { MAX_VACCINE_PHOTOS, joinVaccinePhotos, splitVaccinePhotos } from "./vaccine-photos";

export type StoredBooking = Booking & {
  lineUserId?: string;
  room?: string;
  checkin?: string;
  notes?: string;
  createdAt: string;
  calendarEventId?: string;
  /** เวลาลูกค้ากดยอมรับข้อตกลงก่อนเข้าพัก (ต้องรัน OVERNIGHT_SQL.md ก่อน) */
  consentAcceptedAt?: string;
  /** ข้อความ "แจ้งการดูแลเพิ่มเติม" ที่ลูกค้ากรอกตอนกดยอมรับข้อตกลง */
  careNote?: string;
  /** ลายเซ็นลูกค้าตอนกดยอมรับข้อตกลง (data URL รูป PNG) — หลักฐานยืนยันตัวตน */
  consentSignature?: string;
  /** ภาพสมุดวัคซีนที่แนบตอนยอมรับข้อตกลง (ไม่บังคับ) */
  vaccinePhotoUrl?: string;
  /** ลูกค้าติ๊กยืนยันว่าหยดยาเห็บหมัดมาแล้วในช่วงเข้าพักนี้ — ไว้เป็นหลักฐานถ้าพบเห็บหมัดตอนอยู่ร้าน */
  fleaTickTreated?: boolean;
  /** เวลาที่ลูกค้าเลือกจะมาส่งน้อง (เช็คอิน) */
  arrivalTime?: string;
  /** เวลาที่ลูกค้าเลือกจะมารับน้อง (เช็คเอาท์) */
  pickupTime?: string;
  /** ประวัติน้องก่อนอาบน้ำ (JSON string) ที่ลูกค้ากรอกมา */
  groomHealthInfo?: string;
  /** โปรแกรมอาบน้ำที่เลือกไว้ตอนจอง (เก็บเป็น id ของ GROOM_PROGRAMS) — โชว์ในการ์ด + prefill บิล */
  groomProgram?: string;
  /** ห้องจริงที่ปักหมุดไว้ (เลข 1..จำนวนห้องของ room ประเภทนี้) — ไม่ระบุ = ให้ผังห้องเดารายวัน */
  roomUnit?: number;
  /**
   * ข้อความอัตโนมัติที่ "นัดนี้" ไม่ต้องส่ง (ปิดเป็นรายเคส คนละเรื่องกับปิดทั้งร้านในตั้งค่า)
   * ค่าที่ใช้ได้: ดู AUTO_MESSAGE_TOPICS
   */
  autoOff?: string[];
  /** บริการรับ-ส่งของนัดนี้ (ดู transport.ts) — ไม่มี = ลูกค้ามาเอง */
  transport?: BookingTransport;
  /** ย้ายห้องกลางทาง — ห้องถัดไปตั้งแต่วันไหน (ห้องแรกยังอยู่ที่ room/roomUnit) ดู room-segments.ts */
  roomSegments?: RoomSegment[];
};

export { AUTO_MESSAGE_TOPICS, autoMuted } from "./auto-messages";

type BookingRow = {
  id: string;
  customer_name: string;
  cat_name: string;
  service: string;
  date: string | null;
  time: string | null;
  checkout: string | null;
  checkin: string | null;
  room: string | null;
  line_user_id: string | null;
  notes: string | null;
  status: string;
  checkin_time: string | null;
  calendar_event_id: string | null;
  created_at: string;
  consent_accepted_at?: string | null;
  care_note?: string | null;
  consent_signature?: string | null;
  vaccine_photo_url?: string | null;
  flea_tick_treated?: boolean | null;
  arrival_time?: string | null;
  pickup_time?: string | null;
  groom_health_info?: string | null;
  groom_program?: string | null;
  auto_off?: string[] | null;
  room_unit?: number | null;
  transport?: BookingTransport | null;
  room_segments?: RoomSegment[] | null;
};

const mem: StoredBooking[] = seedEnabled()
  ? [
      {
        id: "B001",
        customerName: "คุณมาย",
        catName: "น้องส้ม",
        service: "groom",
        date: "2026-07-23",
        time: "12:30",
        status: "pending",
        lineUserId: "dev-user",
        createdAt: new Date().toISOString(),
      },
    ]
  : [];

function rowToStored(r: BookingRow): StoredBooking {
  return {
    id: r.id,
    customerName: r.customer_name,
    catName: r.cat_name,
    service: r.service as "groom" | "room",
    date: r.date || "",
    time: r.time || undefined,
    checkout: r.checkout || undefined,
    checkin: r.checkin || undefined,
    room: r.room || undefined,
    lineUserId: r.line_user_id || undefined,
    notes: r.notes || undefined,
    status: r.status as BookingStatus,
    checkinTime: r.checkin_time || undefined,
    calendarEventId: r.calendar_event_id || undefined,
    createdAt: r.created_at,
    consentAcceptedAt: r.consent_accepted_at || undefined,
    careNote: r.care_note || undefined,
    consentSignature: r.consent_signature || undefined,
    vaccinePhotoUrl: r.vaccine_photo_url || undefined,
    fleaTickTreated: r.flea_tick_treated || undefined,
    // เวลามาส่งน้องมีที่เก็บเดียวคือ arrival_time — นัดเก่าที่ลูกค้าเลือกผ่านการ์ด "คิวของฉัน"
    // ก่อนรวมสองหน้าเข้าด้วยกันเก็บไว้แค่ checkin_time จึงใช้ค่านั้นแทนถ้า arrival_time ว่าง
    arrivalTime:
      r.arrival_time || (r.service === "room" ? r.checkin_time : null) || undefined,
    pickupTime: r.pickup_time || undefined,
    groomHealthInfo: r.groom_health_info || undefined,
    groomProgram: r.groom_program || undefined,
    autoOff: r.auto_off || undefined,
    roomUnit: r.room_unit ?? undefined,
    transport: r.transport || undefined,
    roomSegments: r.room_segments?.length ? r.room_segments : undefined,
  };
}

function storedToRow(b: Partial<StoredBooking>) {
  return {
    id: b.id,
    customer_name: b.customerName,
    cat_name: b.catName,
    service: b.service,
    date: b.date || null,
    time: b.time || null,
    checkout: b.checkout || null,
    checkin: b.checkin || null,
    room: b.room || null,
    line_user_id: b.lineUserId || null,
    notes: b.notes || null,
    status: b.status,
    checkin_time: b.checkinTime || null,
    calendar_event_id: b.calendarEventId || null,
    created_at: b.createdAt,
  };
}

export async function listBookings(lineUserId?: string) {
  const sb = getSupabase();
  if (sb) {
    const data = await selectAllRows<BookingRow>((from, to) => {
      let q = sb.from("bookings").select("*").order("created_at", { ascending: false })
        .order("id");
      if (lineUserId) q = q.eq("line_user_id", lineUserId);
      return q.range(from, to);
    });
    return data.map(rowToStored);
  }
  if (!lineUserId) return [...mem];
  return mem.filter((b) => b.lineUserId === lineUserId);
}

/** นัดที่ยังไม่ผูก LINE ลูกค้า — ใช้ตอนผูกนัดเก่าเข้าบัญชี LINE (ไม่ต้องดึงนัดทั้งร้าน) */
export async function listBookingsWithoutLine() {
  const sb = getSupabase();
  if (sb) {
    const data = await selectAllRows<BookingRow>((from, to) =>
      sb.from("bookings").select("*").is("line_user_id", null).order("id").range(from, to)
    );
    return data.map(rowToStored);
  }
  return mem.filter((b) => !b.lineUserId);
}

/** นัดทั้งหมดของลูกค้าชื่อนี้ — ใช้หาน้องตัวอื่นในบ้านที่มานัดเดียวกัน (ไม่ต้องดึงนัดทั้งร้าน) */
export async function listBookingsByCustomerName(customerName: string) {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("bookings").select("*").eq("customer_name", customerName);
    return (data as BookingRow[] | null)?.map(rowToStored) || [];
  }
  return mem.filter((b) => b.customerName === customerName);
}

export async function getBooking(id: string) {
  const sb = getSupabase();
  if (sb) {
    const { data } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
    return data ? rowToStored(data as BookingRow) : undefined;
  }
  return mem.find((b) => b.id === id);
}

/**
 * ลูกค้าเลือกเวลาที่จะมาส่ง/รับน้อง — บันทึกไว้ที่ booking.
 * เขียนเฉพาะคอลัมน์เดียว + ครอบ try/catch (ถ้ายังไม่รัน migration → need_sql).
 */
export async function setBookingTime(
  id: string,
  type: "checkin" | "checkout",
  time: string,
  lineUserId?: string
) {
  const b = await getBooking(id);
  if (!b) return { ok: false as const, error: "not_found" };
  // นัดนี้ผูก LINE ไว้แล้ว → ต้องส่ง lineUserId มาให้ตรงเป๊ะเท่านั้น
  // (เดิมเช็คแค่ "ถ้าส่งมาต้องตรง" — ไม่ส่งมาเลยก็ข้ามการเช็คไปได้ดื้อๆ ปลอมได้ทุกอย่าง)
  if (b.lineUserId && b.lineUserId !== lineUserId) {
    return { ok: false as const, error: "forbidden" };
  }
  // checkin_time เขียนคู่ไปด้วย ให้ปฏิทิน/การ์ดลูกค้าเห็นเวลาเดียวกันเสมอ
  const cols =
    type === "checkin" ? { arrival_time: time, checkin_time: time } : { pickup_time: time };
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from("bookings").update(cols).eq("id", id);
      if (error) return { ok: false as const, error: "need_sql", booking: b };
    } catch {
      return { ok: false as const, error: "need_sql", booking: b };
    }
  } else {
    const idx = mem.findIndex((x) => x.id === id);
    if (idx >= 0) {
      if (type === "checkin") {
        mem[idx].arrivalTime = time;
        mem[idx].checkinTime = time;
      }
      else mem[idx].pickupTime = time;
    }
  }
  return { ok: true as const, booking: b };
}

/**
 * ลูกค้ากรอกประวัติน้องก่อนอาบน้ำ — บันทึก JSON ไว้ที่ booking (graceful, need_sql ถ้ายังไม่มีคอลัมน์)
 */
export async function setBookingGroomInfo(
  id: string,
  infoJson: string,
  lineUserId?: string
) {
  const b = await getBooking(id);
  if (!b) return { ok: false as const, error: "not_found" };
  // นัดนี้ผูก LINE ไว้แล้ว → ต้องส่ง lineUserId มาให้ตรงเป๊ะเท่านั้น
  // (เดิมเช็คแค่ "ถ้าส่งมาต้องตรง" — ไม่ส่งมาเลยก็ข้ามการเช็คไปได้ดื้อๆ ปลอมได้ทุกอย่าง)
  if (b.lineUserId && b.lineUserId !== lineUserId) {
    return { ok: false as const, error: "forbidden" };
  }
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("bookings")
        .update({ groom_health_info: infoJson })
        .eq("id", id);
      if (error) return { ok: false as const, error: "need_sql", booking: b };
    } catch {
      return { ok: false as const, error: "need_sql", booking: b };
    }
  } else {
    const idx = mem.findIndex((x) => x.id === id);
    if (idx >= 0) mem[idx].groomHealthInfo = infoJson;
  }
  return { ok: true as const, booking: b };
}

/**
 * ลูกค้ากดยอมรับข้อตกลงก่อนเข้าพัก — บันทึกเวลาไว้ที่ booking.
 * ต้องรัน OVERNIGHT_SQL.md (consent_accepted_at) ก่อนถึงจะบันทึกลง DB ได้;
 * ถ้ายังไม่มีคอลัมน์ จะ return need_sql โดยไม่ทำให้ endpoint พัง.
 */
export async function acceptBookingConsent(
  id: string,
  lineUserId: string,
  careNote?: string,
  signature?: string,
  vaccinePhotos?: string[],
  fleaTickTreated?: boolean
) {
  const b = await getBooking(id);
  if (!b) return { ok: false as const, error: "not_found" };
  // นัดนี้ผูก LINE ไว้แล้ว → ต้องส่ง lineUserId มาให้ตรงเป๊ะเท่านั้น
  // (เดิมเช็คแค่ "ถ้าส่งมาต้องตรง" — ไม่ส่งมาเลยก็ข้ามการเช็คไปได้ดื้อๆ ปลอมได้ทุกอย่าง)
  if (b.lineUserId && b.lineUserId !== lineUserId) {
    return { ok: false as const, error: "forbidden" };
  }
  const now = new Date().toISOString();
  const note = (careNote || "").trim();
  let sig = (signature || "").trim();
  if (sig.startsWith("data:")) {
    sig = await uploadDataUrlToStorage(`consent-signatures/${id}-${Date.now()}`, sig);
  }
  // แนบได้หลายรูป → อัปโหลดทีละรูป แล้วเก็บรวมในคอลัมน์เดิม (คั่นบรรทัด)
  const vaccineUrls: string[] = [];
  for (const [i, raw] of (vaccinePhotos || []).slice(0, MAX_VACCINE_PHOTOS).entries()) {
    const v = raw.trim();
    if (!v) continue;
    vaccineUrls.push(
      v.startsWith("data:")
        ? await uploadDataUrlToStorage(`consent-vaccine/${id}-${Date.now()}-${i}`, v)
        : v
    );
  }
  // เก็บรูปที่มีอยู่แล้วไว้ด้วย (พนักงานแนบให้ / ลูกค้าส่งมาก่อนจากลิงก์ขอสมุดวัคซีน) — ไม่ทับหาย
  const vaccineUrl = joinVaccinePhotos(
    [...splitVaccinePhotos(b.vaccinePhotoUrl), ...vaccineUrls].slice(-MAX_VACCINE_PHOTOS)
  );
  const treated = Boolean(fleaTickTreated);
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb
        .from("bookings")
        .update({
          consent_accepted_at: now,
          care_note: note || null,
          consent_signature: sig || null,
          vaccine_photo_url: vaccineUrl || null,
          flea_tick_treated: treated,
        })
        .eq("id", id);
      if (error) {
        return { ok: false as const, error: "need_sql", message: error.message };
      }
    } catch (e) {
      return { ok: false as const, error: "need_sql", message: String(e) };
    }
  } else {
    const idx = mem.findIndex((x) => x.id === id);
    if (idx >= 0) {
      mem[idx].consentAcceptedAt = now;
      mem[idx].careNote = note || undefined;
      mem[idx].consentSignature = sig || undefined;
      mem[idx].vaccinePhotoUrl = vaccineUrl || undefined;
      mem[idx].fleaTickTreated = treated;
    }
  }
  return { ok: true as const, acceptedAt: now, vaccineAdded: vaccineUrls };
}

/**
 * แนบรูปสมุดวัคซีนเพิ่มเข้านัด (ต่อท้ายรูปเดิม เก็บได้สูงสุด MAX_VACCINE_PHOTOS รูป — เกินแล้วรูปเก่าสุดหลุด)
 * ใช้ทั้งตอนพนักงานแนบเองในหลังบ้าน และตอนลูกค้าส่งจากลิงก์ขอสมุดวัคซีน
 * รูปเข้า bucket ส่วนตัวเสมอ (เปิดผ่าน /api/files ได้แค่คนของร้าน)
 */
export async function addBookingVaccinePhotos(id: string, photos: string[]) {
  const b = await getBooking(id);
  if (!b) return { ok: false as const, error: "not_found" };
  const added: string[] = [];
  for (const [i, raw] of photos.slice(0, MAX_VACCINE_PHOTOS).entries()) {
    const v = raw.trim();
    if (!v.startsWith("data:image/")) continue;
    added.push(await uploadDataUrlToStorage(`consent-vaccine/${id}-${Date.now()}-${i}`, v));
  }
  if (added.length === 0) return { ok: false as const, error: "no_photo" };
  const urls = [...splitVaccinePhotos(b.vaccinePhotoUrl), ...added].slice(-MAX_VACCINE_PHOTOS);
  const res = await setBookingVaccinePhotos(id, urls);
  return res.ok ? { ok: true as const, urls, added: added.length, addedUrls: added } : res;
}

/** เขียนรายการรูปสมุดวัคซีนของนัดทับทั้งชุด (ใช้ตอนลบรูปออกทีละรูป) */
export async function setBookingVaccinePhotos(id: string, urls: string[]) {
  const value = joinVaccinePhotos(urls);
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb
      .from("bookings")
      .update({ vaccine_photo_url: value || null })
      .eq("id", id)
    if (error) return { ok: false as const, error: "need_sql", message: error.message };
  } else {
    const idx = mem.findIndex((x) => x.id === id);
    if (idx >= 0) mem[idx].vaccinePhotoUrl = value || undefined;
  }
  return { ok: true as const };
}

/**
 * เขียนข้อมูลรับ-ส่ง — คอลัมน์ transport เพิ่มมาทีหลัง เขียนแยกจากแถวหลัก
 * ถ้ายังไม่มีคอลัมน์ ลองอัปเดตฐานข้อมูลให้เองก่อนแล้วเขียนใหม่ (นัดยังบันทึกได้ปกติ)
 */
async function writeTransport(id: string, transport: BookingTransport | null) {
  const sb = getSupabase();
  if (!sb) return true;
  try {
    const { error } = await sb.from("bookings").update({ transport }).eq("id", id);
    if (!error) return true;
    const { ensureMigration } = await import("./migrations");
    if (await ensureMigration("bookings.transport")) {
      const res = await sb.from("bookings").update({ transport }).eq("id", id);
      return !res.error;
    }
  } catch {
    /* ยังไม่มีคอลัมน์ transport */
  }
  return false;
}

/**
 * เขียนช่วงย้ายห้อง — คอลัมน์ room_segments เพิ่มมาทีหลัง เขียนแยกจากแถวหลักเหมือน transport
 * ยังไม่มีคอลัมน์ → ลองอัปเดตฐานข้อมูลให้ก่อน แล้วเขียนใหม่
 */
async function writeRoomSegments(id: string, segs: RoomSegment[]) {
  const sb = getSupabase();
  if (!sb) return true;
  const value = segs.length ? segs : null;
  try {
    const { error } = await sb.from("bookings").update({ room_segments: value }).eq("id", id);
    if (!error) return true;
    const { ensureMigration } = await import("./migrations");
    if (await ensureMigration("bookings.room_segments")) {
      const res = await sb.from("bookings").update({ room_segments: value }).eq("id", id);
      return !res.error;
    }
  } catch {
    /* ยังไม่มีคอลัมน์ room_segments */
  }
  return false;
}

/**
 * ลูกค้ากรอกจุดรับ-ส่ง (ลิงก์ Google Maps + ที่อยู่) ก่อนวันนัด — แก้ได้เฉพาะตำแหน่ง
 * ไม่ให้ลูกค้าเปิด/ปิดบริการรับ-ส่งเอง (ร้านเป็นคนตกลงกับลูกค้า)
 */
export async function setBookingTransportLocation(
  id: string,
  loc: { mapUrl?: string; address?: string },
  lineUserId?: string
) {
  const b = await getBooking(id);
  if (!b) return { ok: false as const, error: "not_found" };
  if (b.lineUserId && b.lineUserId !== lineUserId) {
    return { ok: false as const, error: "forbidden" };
  }
  if (!b.transport || (!b.transport.pickup && !b.transport.dropoff)) {
    return { ok: false as const, error: "no_transport" };
  }
  const next: BookingTransport = { ...b.transport, mapUrl: loc.mapUrl, address: loc.address };
  if (getSupabase()) {
    if (!(await writeTransport(id, next))) return { ok: false as const, error: "need_sql" };
  } else {
    const m = mem.find((x) => x.id === id);
    if (m) m.transport = next;
  }
  return { ok: true as const, booking: { ...b, transport: next } };
}

export async function addBooking(
  data: Omit<StoredBooking, "id" | "createdAt" | "status" | "calendarEventId">
) {
  // ต่อเลขสุ่มท้าย timestamp กันชนกัน — ถ้าจองหลายตัวพร้อมกันเร็วมาก (เช่นจองทั้งบ้าน)
  // Date.now() เพียวๆ มีโอกาสได้ id ซ้ำกันได้ถ้าสร้างในมิลลิวินาทีเดียวกัน แล้ว insert
  // ตัวหลังจะชนคีย์ซ้ำ ทำให้ตัวนั้นหายไปเงียบๆ ทั้งที่ฝั่งลูกค้าเห็นว่าสำเร็จ
  const booking: StoredBooking = {
    ...data,
    id: `B${Date.now()}${Math.random().toString(36).slice(2, 7)}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("bookings").insert(storedToRow(booking));
    if (error) throw new Error(`addBooking failed: ${error.message}`);
    // เขียนโปรแกรมอาบน้ำแยก เพราะ storedToRow ตัดคอลัมน์ใหม่ออก — ร้านที่ยังไม่รัน
    // migration จะ insert แถวหลักได้ปกติ ส่วนโปรแกรมจะเข้าเมื่อรัน SQL แล้ว
    if (booking.groomProgram) {
      try {
        await sb
          .from("bookings")
          .update({ groom_program: booking.groomProgram })
          .eq("id", booking.id);
      } catch {
        /* ยังไม่มีคอลัมน์ groom_program */
      }
    }
    if (booking.roomUnit != null) {
      try {
        await sb.from("bookings").update({ room_unit: booking.roomUnit }).eq("id", booking.id);
      } catch {
        /* ยังไม่มีคอลัมน์ room_unit */
      }
    }
    if (booking.transport) await writeTransport(booking.id, booking.transport);
    if (booking.roomSegments?.length) await writeRoomSegments(booking.id, booking.roomSegments);
    return booking;
  }

  mem.unshift(booking);
  return booking;
}

export async function updateBooking(
  id: string,
  patch: Partial<
    Pick<
      StoredBooking,
      | "status"
      | "checkinTime"
      | "calendarEventId"
      | "customerName"
      | "catName"
      | "service"
      | "date"
      | "time"
      | "checkin"
      | "checkout"
      | "room"
      | "notes"
      | "lineUserId"
      | "autoOff"
      | "groomProgram"
      | "arrivalTime"
      | "pickupTime"
      | "roomUnit"
      | "transport"
      | "roomSegments"
    >
  >
) {
  const sb = getSupabase();
  const existing = await getBooking(id);
  if (!existing) return null;

  const merged = { ...existing, ...patch };
  // ห้องพัก: checkin_time เป็นแค่สำเนาของเวลามาส่งน้อง (arrival_time) — แก้อันหนึ่งต้องตามกันเสมอ
  // ไม่งั้นล้างเวลาแล้ว ค่าเก่าใน checkin_time จะเด้งกลับมา (rowToStored ใช้เป็นค่าสำรอง)
  if (merged.service === "room") {
    if ("arrivalTime" in patch) merged.checkinTime = merged.arrivalTime;
    else if (patch.checkinTime) merged.arrivalTime = patch.checkinTime;
  }

  if (sb) {
    await sb
      .from("bookings")
      .update({
        customer_name: merged.customerName,
        cat_name: merged.catName,
        service: merged.service,
        date: merged.date || null,
        time: merged.time || null,
        checkout: merged.checkout || null,
        checkin: merged.checkin || null,
        room: merged.room || null,
        line_user_id: merged.lineUserId || null,
        notes: merged.notes || null,
        status: merged.status,
        checkin_time: merged.checkinTime || null,
        calendar_event_id: merged.calendarEventId || null,
      })
      .eq("id", id);
    // คอลัมน์ auto_off เพิ่มมาทีหลัง — เขียนแยกและกลืน error ไว้
    // เครื่องที่ยังไม่ได้รัน migration จะได้ไม่พังทั้งการบันทึกนัด
    if (patch.autoOff !== undefined) {
      try {
        await sb
          .from("bookings")
          .update({ auto_off: merged.autoOff || [] })
          .eq("id", id);
      } catch {
        /* ยังไม่มีคอลัมน์ — ข้ามไป ฟีเจอร์จะทำงานเมื่ออัปเดตฐานข้อมูลแล้ว */
      }
    }
    // โปรแกรมอาบน้ำ — เขียนแยกเช่นกัน (คอลัมน์ groom_program เพิ่มมาทีหลัง)
    if (patch.groomProgram !== undefined) {
      try {
        await sb
          .from("bookings")
          .update({ groom_program: merged.groomProgram || null })
          .eq("id", id);
      } catch {
        /* ยังไม่มีคอลัมน์ groom_program */
      }
    }
    // ห้องจริงที่ปักหมุด — คอลัมน์ room_unit เพิ่มมาทีหลัง เขียนแยกเช่นกัน
    // 0 = ถอนหมุด (ให้ระบบเดาเอง) เก็บเป็น null ในฐานข้อมูล ไม่ใช่ 0 (ไม่ใช่เลขห้องจริง)
    if (patch.roomUnit !== undefined) {
      try {
        await sb
          .from("bookings")
          .update({ room_unit: merged.roomUnit || null })
          .eq("id", id);
      } catch {
        /* ยังไม่มีคอลัมน์ room_unit */
      }
    }
    // เวลาส่ง/รับน้อง — คอลัมน์เพิ่มมาทีหลัง เขียนแยก (เดิมไม่ได้เขียนเลย เวลาที่ร้านกรอกแทนลูกค้าเลยหาย)
    if ("arrivalTime" in patch || "pickupTime" in patch) {
      try {
        await sb
          .from("bookings")
          .update({
            arrival_time: merged.arrivalTime || null,
            pickup_time: merged.pickupTime || null,
          })
          .eq("id", id);
      } catch {
        /* ยังไม่มีคอลัมน์ arrival_time / pickup_time */
      }
    }
    // รับ-ส่ง — undefined ใน patch = ไม่ได้ส่งมา, ส่งมาเป็นค่าว่างให้ล้างทิ้ง (ใช้ "transport" in patch)
    if ("transport" in patch) await writeTransport(id, merged.transport || null);
    if ("roomSegments" in patch) await writeRoomSegments(id, merged.roomSegments || []);
    return getBooking(id);
  }

  const b = mem.find((x) => x.id === id);
  if (!b) return null;
  Object.assign(b, patch);
  return b;
}

export async function cancelBooking(id: string) {
  return updateBooking(id, { status: "cancelled" });
}

/**
 * ลบนัดทิ้งถาวรจากหลังบ้าน — เผื่อลงข้อมูลผิด (คนละเรื่องกับ cancelBooking
 * ที่แค่เปลี่ยนสถานะ) ลบแล้วหายจากประวัติที่ลูกค้าเห็นในแอปของตัวเองด้วย
 */
export async function deleteBooking(id: string) {
  const sb = getSupabase();
  if (sb) {
    await sb.from("bookings").delete().eq("id", id);
  } else {
    const i = mem.findIndex((b) => b.id === id);
    if (i >= 0) mem.splice(i, 1);
  }
  return { ok: true as const };
}

export async function bookingsForDate(isoDate: string) {
  const all = await listBookings();
  return all.filter(
    (b) =>
      b.status !== "cancelled" &&
      (b.date === isoDate || b.checkin === isoDate)
  );
}

export async function bookingsTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const key = tomorrow.toISOString().slice(0, 10);
  const all = await listBookings();
  return all.filter(
    (b) =>
      b.status === "pending" &&
      (b.date === key || b.checkin === key) &&
      Boolean(b.lineUserId)
  );
}

export function toBooking(b: StoredBooking): Booking {
  return {
    id: b.id,
    customerName: b.customerName,
    catName: b.catName,
    service: b.service,
    date: b.date || b.checkin || "",
    time: b.time,
    checkout: b.checkout,
    roomType: b.room,
    status: b.status as BookingStatus,
    checkinTime: b.checkinTime,
  };
}
