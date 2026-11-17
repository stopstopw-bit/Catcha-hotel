/**
 * แท็กสำเร็จรูป "เรื่องที่ช่างต้องรู้" — ให้ลูกค้าแตะเลือกแทนพิมพ์เอง
 * ลดพิมพ์ผิด/ลืมบอก และช่างอ่านเป็นคำเดียวกันทุกบิล ค้นหาย้อนหลังก็ตรงกัน
 *
 * แบ่ง category ไว้เพื่อ map กลับเข้าฟิลด์เดิม 2 ช่องที่ระบบมีอยู่แล้ว:
 * medical (โรคประจำตัว/ยา) และ staffNote (นิสัย/พฤติกรรม) — โครงสร้างข้อมูล
 * ปลายทางไม่ต้องแก้ ของเดิมที่เคยพิมพ์เป็นข้อความอิสระไว้ก็ยังอ่านได้ปกติ
 * (แค่ไม่ติ๊กเป็นแท็กให้อัตโนมัติ จะไปโผล่ในช่อง "อื่นๆ" แทน)
 */
export type StaffNoteTag = {
  id: string;
  label: string;
  /** ชื่อภาษาอังกฤษ — โชว์ตอนลูกค้าสลับเป็น EN (ค่าที่บันทึกยังเป็น label ไทยเหมือนเดิม) */
  labelEn: string;
  category: "medical" | "behavior";
};

export const STAFF_NOTE_TAGS: StaffNoteTag[] = [
  // สุขภาพ/โรคประจำตัว
  { id: "liver", label: "โรคตับ", labelEn: "Liver disease", category: "medical" },
  { id: "kidney", label: "โรคไต", labelEn: "Kidney disease", category: "medical" },
  { id: "heart", label: "โรคหัวใจ", labelEn: "Heart disease", category: "medical" },
  { id: "diabetes", label: "เบาหวาน", labelEn: "Diabetes", category: "medical" },
  { id: "seizure", label: "ลมชัก", labelEn: "Epilepsy / seizures", category: "medical" },
  { id: "hip", label: "ข้อสะโพก / ขาหลังอ่อนแรง", labelEn: "Hip problems / weak hind legs", category: "medical" },
  { id: "disc", label: "หมอนรองกระดูก", labelEn: "Spinal disc problems", category: "medical" },
  { id: "eye", label: "ตาเป็นต้อ / มองไม่ค่อยเห็น", labelEn: "Cataracts / poor eyesight", category: "medical" },
  { id: "ear", label: "หูอักเสบ / หูไม่ได้ยิน", labelEn: "Ear infection / hearing loss", category: "medical" },
  { id: "brachy", label: "หอบง่าย / หน้าสั้น", labelEn: "Breathes heavily / flat-faced", category: "medical" },
  { id: "surgery", label: "เพิ่งผ่าตัด / มีแผล", labelEn: "Recent surgery / has a wound", category: "medical" },
  { id: "pregnant", label: "ตั้งท้อง / ให้นม", labelEn: "Pregnant / nursing", category: "medical" },
  { id: "shampoo-allergy", label: "แพ้แชมพู / ผิวแพ้ง่าย", labelEn: "Shampoo allergy / sensitive skin", category: "medical" },
  { id: "skin", label: "ผิวหนังอักเสบ / เชื้อรา", labelEn: "Skin inflammation / fungal infection", category: "medical" },
  { id: "flea", label: "เห็บ หมัด ไรขี้เรื้อน", labelEn: "Ticks, fleas or mange", category: "medical" },
  { id: "matted", label: "ขนพันกันง่าย", labelEn: "Fur mats easily", category: "medical" },
  { id: "senior", label: "สูงวัย", labelEn: "Senior cat", category: "medical" },

  // นิสัย/พฤติกรรม
  { id: "shy", label: "ตื่นคนแปลกหน้า / เสียงดัง", labelEn: "Scared of strangers / loud noises", category: "behavior" },
  { id: "dryer-scared", label: "กลัวเสียงไดร์", labelEn: "Scared of the hair dryer", category: "behavior" },
  { id: "nail-fussy", label: "ดุตอนตัดเล็บ", labelEn: "Fussy during nail trims", category: "behavior" },
  { id: "cage-fussy", label: "ไม่ชอบอยู่กรง", labelEn: "Dislikes cages", category: "behavior" },
  { id: "bite", label: "กัด / ข่วน", labelEn: "Bites / scratches", category: "behavior" },
];
