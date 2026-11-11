/**
 * รูปโปสเตอร์ของฟอร์มลูกค้า — ร้านอัปเอง/ลบ/เรียงได้ในหลังบ้าน (การ์ด & ฟอร์ม)
 * groom/stay: โชว์เป็นหน้าแรกก่อนเริ่มตอบคำถาม (มีปุ่ม "อ่านแล้ว เริ่มกรอกข้อมูลน้อง")
 * register: โชว์ด้านบนฟอร์มสมัครสมาชิก
 * ยังไม่เคยตั้ง = ใช้รูปเริ่มต้นของร้าน · ตั้งเป็นรายการว่าง = ไม่มีหน้ารูป เข้าคำถามเลย
 */
export type FormPosterKey = "groom" | "stay" | "register";

/** null = กลับไปใช้รูปเริ่มต้น (ส่ง null ตอนบันทึกเพื่อลบค่าที่ร้านเคยตั้ง) */
export type FormPostersConfig = Partial<Record<FormPosterKey, string[] | null>>;

export const DEFAULT_FORM_POSTERS: Record<FormPosterKey, string[]> = {
  groom: ["/catalog/grooming/bath-prep.jpg"],
  stay: ["/info/stay-conditions.jpg"],
  register: [],
};

export function resolveFormPosters(cfg: FormPostersConfig | undefined, key: FormPosterKey): string[] {
  const list = cfg?.[key];
  if (!Array.isArray(list)) return DEFAULT_FORM_POSTERS[key];
  return list.filter((s) => typeof s === "string" && s.trim());
}
