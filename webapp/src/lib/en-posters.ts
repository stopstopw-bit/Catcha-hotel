/**
 * โปสเตอร์ฉบับภาษาอังกฤษ (เจ้าของร้านทำมาให้ 2026-11-18) — ลูกค้าที่ใช้ภาษาอังกฤษจะเห็นรูปพวกนี้แทนรูปไทย
 * จับคู่ด้วย path ของรูปไทยเริ่มต้น · ถ้าร้านเปลี่ยนรูปเองในหลังบ้าน (path อื่น) จะแสดงรูปที่ร้านตั้งตามเดิม
 */
import type { Locale } from "@/lib/business";

const D = "/catalog/en";

export const EN_POSTERS: Record<string, string> = {
  // ห้องพัก
  "/catalog/rooms/cat-hotel-bangna-mini-meow.jpg": `${D}/room-mini-meow.jpg`,
  "/catalog/rooms/cat-hotel-bangna-mid-cozy.jpg": `${D}/room-mid-cozy.jpg`,
  "/catalog/rooms/cat-hotel-bangna-catflix.jpg": `${D}/room-catflix.jpg`,
  "/catalog/rooms/cat-hotel-bangna-mini-duo.jpg": `${D}/room-mini-duo.jpg`,
  "/catalog/rooms/cat-hotel-bangna-cozy-duo.jpg": `${D}/room-cozy-duo.jpg`,
  "/catalog/rooms/cat-hotel-bangna-cat-tower.jpg": `${D}/room-cat-tower.jpg`,
  // เมนู/ข้อมูลก่อนอาบน้ำ
  "/catalog/grooming/grooming-menu.jpg": `${D}/grooming-menu.jpg`,
  "/catalog/grooming/bath-prep.jpg": `${D}/before-grooming.jpg`,
  "/info/bath-info.jpg": `${D}/before-grooming.jpg`,
  // ฝากพัก
  "/info/stay-conditions.jpg": `${D}/stay-conditions.jpg`,
  "/info/stay-rules.jpg": `${D}/stay-conditions.jpg`,
  "/info/before-stay.jpg": `${D}/before-check-in.jpg`,
  "/info/flea-rules-before-stay.jpg": `${D}/before-check-in.jpg`,
  "/info/prepare-checkin.jpg": `${D}/prepare-check-in.jpg`,
  "/info/hours.jpg": `${D}/hours.jpg`,
  "/info/booking-steps.jpg": `${D}/booking-steps.jpg`,
  // สมาชิก/คะแนน
  "/info/new-member.jpg": `${D}/new-member.jpg`,
  "/info/rewards.jpg": `${D}/rewards.jpg`,
  "/catalog/services/points.jpg": `${D}/rewards.jpg`,
  // รับ-ส่ง
  "/info/transport.jpg": `${D}/transport.jpg`,
  "/catalog/services/transport.jpg": `${D}/transport.jpg`,
};

/** รูปห้องอังกฤษตาม id ห้อง — ใช้ตอนร้านเปลี่ยนรูปไทยเป็นไฟล์อัปโหลด (path ไม่ตรงกับรูปเริ่มต้น) */
export const ROOM_EN_POSTERS: Record<string, string> = {
  "mini-meow": `${D}/room-mini-meow.jpg`,
  "mid-cozy": `${D}/room-mid-cozy.jpg`,
  catflix: `${D}/room-catflix.jpg`,
  "mini-duo": `${D}/room-mini-duo.jpg`,
  "cozy-duo": `${D}/room-cozy-duo.jpg`,
  "cat-tower": `${D}/room-cat-tower.jpg`,
};

/** รูปอังกฤษของห้อง: ร้านตั้งเอง > รูปเริ่มต้นตาม id ห้อง > (posterFor จับคู่ด้วย path รูปไทย) */
export function roomEnPoster(room: { id: string; imageEn?: string }): string | undefined {
  return room.imageEn?.trim() || ROOM_EN_POSTERS[room.id];
}

/** รูปอังกฤษเริ่มต้นของรูปไทยนี้ (ไม่มี = "") — ใช้โชว์ในหลังบ้านว่าตอนนี้ลูกค้า English เห็นรูปอะไร */
export function defaultEnPoster(src: string | undefined): string {
  if (!src) return "";
  const path = src.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
  return EN_POSTERS[path] ?? "";
}

/** คืน path รูปภาษาอังกฤษ ถ้าลูกค้าใช้ภาษาอังกฤษและมีรูปคู่กัน — ไม่งั้นคืนรูปเดิม */
export function posterFor(src: string, locale: Locale | string | undefined, en?: string): string {
  if (locale !== "en") return src;
  if (en && en.trim()) return en;
  if (!src) return src;
  const path = src.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
  return EN_POSTERS[path] ?? src;
}
