/**
 * รูปโปสเตอร์ของฟอร์มลูกค้า — ร้านอัปเอง/ลบ/เรียงได้ในหลังบ้าน (การ์ด & ฟอร์ม)
 * groom/stay: โชว์เป็นหน้าแรกก่อนเริ่มตอบคำถาม (มีปุ่ม "อ่านแล้ว เริ่มกรอกข้อมูลน้อง")
 * register: โชว์ด้านบนฟอร์มสมัครสมาชิก
 * ยังไม่เคยตั้ง = ใช้รูปเริ่มต้นของร้าน · ตั้งเป็นรายการว่าง = ไม่มีหน้ารูป เข้าคำถามเลย
 * groomEn/stayEn/registerEn = ชุดรูปของลูกค้าภาษาอังกฤษ · ยังไม่เคยตั้ง = ใช้รูปไทยแปลงเป็นรูปอังกฤษที่มีคู่กัน
 */
import { posterFor } from "@/lib/en-posters";

export type FormPosterBaseKey = "groom" | "stay" | "register";
export type FormPosterKey = FormPosterBaseKey | "groomEn" | "stayEn" | "registerEn";

/** null = กลับไปใช้รูปเริ่มต้น (ส่ง null ตอนบันทึกเพื่อลบค่าที่ร้านเคยตั้ง) */
export type FormPostersConfig = Partial<Record<FormPosterKey, string[] | null>>;

export const DEFAULT_FORM_POSTERS: Record<FormPosterBaseKey, string[]> = {
  groom: ["/catalog/grooming/bath-prep.jpg"],
  stay: ["/info/stay-conditions.jpg"],
  register: [],
};

function clean(list: string[]): string[] {
  return list.filter((s) => typeof s === "string" && s.trim());
}

export function resolveFormPosters(cfg: FormPostersConfig | undefined, key: FormPosterBaseKey): string[] {
  const list = cfg?.[key];
  if (!Array.isArray(list)) return DEFAULT_FORM_POSTERS[key];
  return clean(list);
}

/** รูปชุดอังกฤษ: ร้านตั้งเองแล้วใช้ของร้าน — ไม่งั้นใช้ชุดไทยที่แปลงเป็นรูปอังกฤษที่มีคู่กัน */
export function resolveFormPostersEn(cfg: FormPostersConfig | undefined, key: FormPosterBaseKey): string[] {
  const list = cfg?.[`${key}En` as FormPosterKey];
  if (Array.isArray(list)) return clean(list);
  return resolveFormPosters(cfg, key).map((src) => posterFor(src, "en"));
}

export function resolveFormPostersFor(
  cfg: FormPostersConfig | undefined,
  key: FormPosterBaseKey,
  locale: string | undefined
): string[] {
  return locale === "en" ? resolveFormPostersEn(cfg, key) : resolveFormPosters(cfg, key);
}
