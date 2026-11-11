/**
 * หน้าลิงก์รวมของร้าน (/links) — แบบ heylink/linktree แต่เป็นของร้านเอง
 *
 * แปะลิงก์คนละอันในแต่ละแพลตฟอร์ม เช่น IG bio = /links/ig, TikTok = /links/tiktok
 * ทุกปุ่มวิ่งผ่าน /go/<ปุ่ม>?src=<แพลตฟอร์ม> → บันทึกคลิกแล้วค่อยพาไปปลายทาง
 * หลังบ้าน (สรุปข้อมูล) สรุปยอดเปิดหน้า/คลิกแยกตามแพลตฟอร์มและปุ่ม
 */
import { BUSINESS } from "./business";

export type LinkPlatform = { id: string; label: string; hint: string };

/** แพลตฟอร์มที่แนะนำให้แปะ — src อื่นที่ไม่อยู่ในนี้ก็นับได้ (เช่น /links/poster) */
export const LINK_PLATFORMS: LinkPlatform[] = [
  { id: "ig", label: "Instagram", hint: "ใส่ใน bio IG" },
  { id: "tiktok", label: "TikTok", hint: "ใส่ใน bio TikTok" },
  { id: "fb", label: "Facebook", hint: "หน้าเพจ / โพสต์" },
  { id: "line", label: "LINE", hint: "LINE OA / กลุ่มแชท" },
  { id: "google", label: "Google Maps", hint: "Google Business Profile" },
  { id: "youtube", label: "YouTube", hint: "คำอธิบายคลิป" },
  { id: "threads", label: "Threads", hint: "bio Threads" },
  { id: "qr", label: "QR หน้าร้าน", hint: "ทำ QR จากลิงก์นี้ไปติดหน้าร้าน" },
];

export const DIRECT_SRC = "direct";

/** ทำ src ให้ปลอดภัย: ตัวเล็ก a-z 0-9 - เท่านั้น ยาวไม่เกิน 24 — ว่าง = direct */
export function cleanSrc(raw: string | null | undefined): string {
  const s = (raw || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24);
  return s || DIRECT_SRC;
}

export function platformLabel(src: string): string {
  if (src === DIRECT_SRC) return "ไม่ระบุ (ลิงก์ /links ตรงๆ)";
  return LINK_PLATFORMS.find((p) => p.id === src)?.label ?? src;
}

export type LinkButton = {
  key: string;
  label: string;
  sub?: string;
  icon: string;
  /** ปุ่มหลัก (สีเขียว LINE) */
  primary?: boolean;
  /** ช่องทางโซเชียลของร้าน — โชว์เป็นการ์ดใหญ่สีแบรนด์ในหมวด "ช่องทางของเรา" */
  social?: boolean;
  /** สีพื้นการ์ดช่องทาง (CSS background) */
  brand?: string;
  /** ปลายทาง — src ส่งมาให้ติด UTM กับหน้าในเว็บเราเอง */
  href: (src: string) => string;
};

const utm = (src: string, content: string) =>
  `utm_source=${encodeURIComponent(src)}&utm_medium=social&utm_campaign=links&utm_content=${content}`;

export const LINK_BUTTONS: LinkButton[] = [
  { key: "line", label: "ทัก LINE จองคิว / สอบถาม", sub: BUSINESS.lineOa, icon: "💬", primary: true, href: () => BUSINESS.social.line },
  { key: "rooms", label: "ห้องพักแมว & ราคา", sub: "รูปห้องจริงทุกห้อง", icon: "🏨", href: (s) => `/cat-hotel?${utm(s, "rooms")}` },
  { key: "bath", label: "อาบน้ำแมว & กรูมมิ่ง", sub: "เมนูและราคา", icon: "🛁", href: (s) => `/cat-bath?${utm(s, "bath")}` },
  { key: "promos", label: "โปรโมชั่น & คอร์ส", icon: "🎁", href: (s) => `/?${utm(s, "promos")}#promos` },
  { key: "guide", label: "คู่มือดูแลแมวฟรี", sub: "Catcha Cat Academy", icon: "📖", href: (s) => `https://guide.catchahotel.com/?${utm(s, "guide")}` },
  { key: "map", label: "แผนที่ร้าน", sub: BUSINESS.location.th, icon: "📍", href: () => BUSINESS.maps },
  { key: "review", label: "อ่าน/เขียนรีวิว Google", icon: "⭐", href: () => BUSINESS.reviewUrl },
  { key: "phone", label: `โทร ${BUSINESS.phones[0]}`, icon: "📞", href: () => `tel:${BUSINESS.phones[0].replace(/-/g, "")}` },
  { key: "ig", label: "Instagram", sub: "รูปน้องแมวที่มาพักทุกวัน", icon: "ig", social: true, brand: "linear-gradient(135deg,#feda75,#fa7e1e 30%,#d62976 60%,#962fbf 85%,#4f5bd5)", href: () => BUSINESS.social.instagram },
  { key: "tiktok", label: "TikTok", sub: "คลิปสั้นน้องแมว", icon: "tiktok", social: true, brand: "#111111", href: () => BUSINESS.social.tiktok },
  { key: "fb", label: "Facebook", sub: "เพจร้าน รีวิว ข่าวโปร", icon: "fb", social: true, brand: "#1877f2", href: () => BUSINESS.social.facebook },
  { key: "lineoa", label: "LINE OA", sub: BUSINESS.lineOa, icon: "line", social: true, brand: "#06c755", href: () => BUSINESS.social.line },
];

export function buttonLabel(key: string): string {
  return LINK_BUTTONS.find((b) => b.key === key)?.label ?? key;
}

/** บอท/ตัวดึงพรีวิวลิงก์ (LINE/FB/X ดึงหน้าไปทำการ์ด) — ไม่นับ */
const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|facebot|embedly|preview|whatsapp|telegram|discord|skype|curl|wget|python|node-fetch|axios|go-http|headless|lighthouse|vercel/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return true;
  return BOT_UA.test(ua);
}
