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
  // ข้อมูลก่อนอาบน้ำ
  "/catalog/grooming/bath-prep.jpg": `${D}/before-grooming.jpg`,
  "/info/bath-info.jpg": `${D}/before-grooming.jpg`,
  // ฝากพัก
  "/info/stay-conditions.jpg": `${D}/stay-conditions.jpg`,
  "/info/stay-rules.jpg": `${D}/stay-conditions.jpg`,
  "/info/before-stay.jpg": `${D}/before-check-in.jpg`,
  "/info/flea-rules-before-stay.jpg": `${D}/before-check-in.jpg`,
  "/info/prepare-checkin.jpg": `${D}/prepare-check-in.jpg`,
  "/info/hours.jpg": `${D}/hours.jpg`,
  // รับ-ส่ง
  "/info/transport.jpg": `${D}/transport.jpg`,
  "/catalog/services/transport.jpg": `${D}/transport.jpg`,
};

/** คืน path รูปภาษาอังกฤษ ถ้าลูกค้าใช้ภาษาอังกฤษและมีรูปคู่กัน — ไม่งั้นคืนรูปเดิม */
export function posterFor(src: string, locale: Locale | string | undefined): string {
  if (locale !== "en" || !src) return src;
  const path = src.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
  return EN_POSTERS[path] ?? src;
}
