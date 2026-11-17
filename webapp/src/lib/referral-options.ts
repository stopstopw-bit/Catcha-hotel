/** ช่องทางที่ลูกค้ารู้จักร้าน — ค่าเริ่มต้นถ้าร้านยังไม่ได้ตั้งเองในหน้าตั้งค่า */
export const REFERRAL_OPTIONS = [
  "Facebook",
  "Instagram",
  "TikTok",
  "Google / ค้นหา",
  "Google Maps",
  "เพื่อนแนะนำ / ผ่านหน้าร้าน",
];

/** ชื่อภาษาอังกฤษของตัวเลือกเริ่มต้น — โชว์ตอนฟอร์มเป็น EN แต่ค่าที่บันทึกยังเป็นไทย (สถิติไม่แตก) */
export const REFERRAL_OPTIONS_EN: Record<string, string> = {
  "Google / ค้นหา": "Google search",
  "เพื่อนแนะนำ / ผ่านหน้าร้าน": "Friend / walked past the shop",
};
