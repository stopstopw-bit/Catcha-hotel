/**
 * ช่องในฟอร์มสมัครสมาชิก — ร้านเปิด/ปิด, บังคับ/ไม่บังคับ และแก้ชื่อช่องเองได้ในหลังบ้าน (การ์ด › ฟอร์มสมัครสมาชิก)
 * ชื่อผู้ปกครอง / เบอร์โทร / ชื่อน้อง ล็อกไว้ (ระบบต้องใช้ระบุตัวลูกค้า)
 * key ห้ามเปลี่ยน (ค่าที่ร้านตั้งไว้อ้างอิงอยู่)
 */

export type RegisterFieldKey =
  | "ownerName"
  | "phone"
  | "email"
  | "ownerBirthday"
  | "postalCode"
  | "catName"
  | "gender"
  | "breed"
  | "furLength"
  | "neutered"
  | "color"
  | "age"
  | "weight"
  | "medical"
  | "seizure"
  | "allergy"
  | "referral";

export type RegisterFieldConfig = { enabled?: boolean; required?: boolean; label?: string };
export type RegisterFormConfig = Partial<Record<RegisterFieldKey, RegisterFieldConfig>>;

export type RegisterFieldDef = {
  key: RegisterFieldKey;
  group: "owner" | "cat" | "end";
  label: string;
  required: boolean;
  enabled: boolean;
  /** ปิด/เลิกบังคับไม่ได้ — แก้ได้แค่ชื่อช่อง */
  locked?: boolean;
};

export const REGISTER_FORM_DEFAULTS: RegisterFieldDef[] = [
  { key: "ownerName", group: "owner", label: "ชื่อผู้ปกครอง", required: true, enabled: true, locked: true },
  { key: "phone", group: "owner", label: "เบอร์โทร", required: true, enabled: true, locked: true },
  { key: "email", group: "owner", label: "อีเมล", required: true, enabled: true },
  { key: "ownerBirthday", group: "owner", label: "วันเกิดผู้ปกครอง", required: true, enabled: true },
  { key: "postalCode", group: "owner", label: "รหัสไปรษณีย์", required: true, enabled: true },
  { key: "catName", group: "cat", label: "ชื่อน้องแมว", required: true, enabled: true, locked: true },
  { key: "gender", group: "cat", label: "เพศ", required: true, enabled: true },
  { key: "breed", group: "cat", label: "สายพันธุ์", required: true, enabled: true },
  { key: "furLength", group: "cat", label: "ลักษณะขน", required: true, enabled: true },
  { key: "neutered", group: "cat", label: "ทำหมัน", required: true, enabled: true },
  { key: "color", group: "cat", label: "สี/ลักษณะเด่น", required: false, enabled: true },
  { key: "age", group: "cat", label: "อายุ / วันเกิดน้อง", required: false, enabled: true },
  { key: "weight", group: "cat", label: "น้ำหนัก (กก.)", required: true, enabled: true },
  { key: "medical", group: "cat", label: "โรคประจำตัว / เรื่องที่ช่างต้องรู้", required: false, enabled: true },
  { key: "seizure", group: "cat", label: "ประวัติการชัก/ช็อค", required: false, enabled: true },
  { key: "allergy", group: "cat", label: "ประวัติการแพ้ (อาหาร / ยา / แชมพู)", required: false, enabled: true },
  { key: "referral", group: "end", label: "รู้จักเราจากทางไหน?", required: true, enabled: true },
];

export const REGISTER_GROUP_LABELS: Record<RegisterFieldDef["group"], string> = {
  owner: "ข้อมูลผู้ปกครอง",
  cat: "น้องแมว (ถามทีละตัว)",
  end: "ท้ายฟอร์ม",
};

/** รวมค่าเริ่มต้นกับที่ร้านตั้งเอง — คืนทุกช่อง (รวมที่ปิด) เรียกด้วย key ได้ */
export function resolveRegisterForm(config?: RegisterFormConfig): Record<RegisterFieldKey, RegisterFieldDef> {
  const out = {} as Record<RegisterFieldKey, RegisterFieldDef>;
  for (const def of REGISTER_FORM_DEFAULTS) {
    const c = config?.[def.key];
    const enabled = def.locked ? true : c?.enabled ?? def.enabled;
    out[def.key] = {
      ...def,
      enabled,
      required: def.locked ? true : enabled && (c?.required ?? def.required),
      label: c?.label?.trim() || def.label,
    };
  }
  return out;
}

/** ชื่อช่องภาษาอังกฤษ — ใช้ตอนลูกค้าสลับฟอร์มเป็น EN (ชื่อที่ร้านแก้เองเป็นภาษาไทย จึงใช้ชุดนี้แทน) */
export const REGISTER_LABELS_EN: Record<RegisterFieldKey, string> = {
  ownerName: "Your name",
  phone: "Phone number",
  email: "Email",
  ownerBirthday: "Your birthday",
  postalCode: "Postal code",
  catName: "Cat's name",
  gender: "Sex",
  breed: "Breed",
  furLength: "Coat",
  neutered: "Neutered / spayed",
  color: "Colour / markings",
  age: "Age / birthday",
  weight: "Weight (kg)",
  medical: "Health conditions / things our staff should know",
  seizure: "History of seizures / collapse",
  allergy: "Allergies (food / medicine / shampoo)",
  referral: "How did you hear about us?",
};

/** ใส่ป้ายภาษาอังกฤษทับทุกช่อง (เปิด/บังคับตามที่ร้านตั้งเหมือนเดิม) */
export function localizeRegisterForm(
  rf: Record<RegisterFieldKey, RegisterFieldDef>,
  locale: "th" | "en"
): Record<RegisterFieldKey, RegisterFieldDef> {
  if (locale !== "en") return rf;
  const out = {} as Record<RegisterFieldKey, RegisterFieldDef>;
  for (const k of Object.keys(rf) as RegisterFieldKey[]) out[k] = { ...rf[k], label: REGISTER_LABELS_EN[k] };
  return out;
}
