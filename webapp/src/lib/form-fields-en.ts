/**
 * ป้ายภาษาอังกฤษของคำถามฟอร์ม "ก่อนอาบน้ำ" และ "ก่อนเข้าพัก" — ลูกค้าที่เลือก English เห็นคำถามเป็นอังกฤษ
 * แปลตาม key ของคำถาม/ตัวเลือก (เหมือนฟอร์มสมัครสมาชิก) · คำตอบที่บันทึกยังเป็น key เดิม หลังบ้านอ่านเหมือนเดิม
 * ตัวเลือกที่ร้านเพิ่มเอง (key ไม่อยู่ในรายการนี้) แสดงตามที่ร้านพิมพ์
 */
import type { GroomField } from "@/lib/groom-form";

type FieldEn = { label: string; placeholder?: string; options?: Record<string, string> };

const YES_NO_SHAVE = { yes: "✅ Yes, please", no: "❌ No" };
const VACCINE = { yes: "✅ Fully vaccinated", no: "❌ Not yet" };

export const GROOM_FIELDS_EN: Record<string, FieldEn> = {
  bathedBefore: {
    label: "Has your cat been bathed elsewhere before, or is this the first time?",
    options: { yes: "✅ Bathed elsewhere before", no: "🆕 First time" },
  },
  temperament: {
    label: "Behaviour when held / bathed (choose any)",
    options: {
      normal: "🙂 Calm",
      playful: "😸 Playful",
      clingy: "🥰 Affectionate",
      stressed: "😿 Easily stressed",
      gentle: "😌 Gentle, easy to handle",
      fearful: "🙀 Timid / easily startled",
      struggle: "🌀 Wriggles",
      aggressive: "😾 Bites / scratches",
      strangerShy: "🙈 Shy with strangers",
      other: "➕ Other",
    },
  },
  health: {
    label: "Health (choose any)",
    options: {
      healthy: "💪 Healthy",
      skin: "🩹 Skin condition",
      seizure: "⚡ Seizures",
      senior: "👵 Senior",
      other: "➕ Other",
    },
  },
  heartDisease: {
    label: "Does your cat have heart disease?",
    options: { no: "✅ No", yes: "❤️ Yes, heart disease", unknown: "❓ Never checked" },
  },
  vaccinated: { label: "Is your cat fully vaccinated?", options: VACCINE },
  weight: { label: "Weight (kg), a rough guess is fine", placeholder: "e.g. 4.5" },
  dryMethod: {
    label: "How has your cat been dried before? (choose any)",
    options: { dryer: "💨 Hand dryer", cabinet: "📦 Drying cabinet" },
  },
  shaveButt: { label: "Trim the fur around the bottom?", options: YES_NO_SHAVE },
  shavePaws: { label: "Trim the fur on the paw pads?", options: YES_NO_SHAVE },
  allergy: {
    label: "Any allergies (shampoo / medicine)? Leave blank if none",
    placeholder: "e.g. allergic to some shampoos",
  },
  note: {
    label: "Anything we should take extra care with?",
    placeholder: "e.g. dislikes strong dryers, scared of loud noises",
  },
};

export const STAY_FIELDS_EN: Record<string, FieldEn> = {
  food: {
    label: "What does your cat usually eat (brand / dry / wet)? Please bring your cat's food",
    placeholder: "e.g. Royal Canin dry + wet food in the evening",
  },
  meals: {
    label: "How many meals a day, and how much per meal?",
    placeholder: "e.g. 2 meals, morning and evening, 1/4 cup each",
  },
  snacks: { label: "Treats allowed / not allowed (if any)", placeholder: "e.g. 1 treat a day is fine" },
  likes: {
    label: "What does your cat like (toys / being held / kind of bed)?",
    placeholder: "e.g. loves ball toys, likes sleeping somewhere dark",
  },
  dislikes: {
    label: "What does your cat dislike or fear?",
    placeholder: "e.g. doesn't like belly touches, scared of loud noises",
  },
  withOthers: {
    label: "Is your cat OK with other cats?",
    options: { ok: "😺 Gets along with others", alone: "🙀 Prefers to be alone", unknown: "❓ Not sure" },
  },
  litter: { label: "Litter used / toilet habits we should know", placeholder: "e.g. tofu litter, normal toilet habits" },
  vaccinated: { label: "Is your cat fully vaccinated?", options: VACCINE },
  medical: {
    label: "Health conditions / medication (leave blank if none)",
    placeholder: "e.g. kidney medicine morning and evening after meals",
  },
  note: {
    label: "Anything you'd like us to take special care with?",
    placeholder: "e.g. photo updates every evening, please brush daily",
  },
};

/** แปลงคำถามเป็นอังกฤษตาม key (ภาษาไทย = คืนเดิม) */
export function localizeFormFields(
  fields: GroomField[],
  dict: Record<string, FieldEn>,
  locale: string | undefined
): GroomField[] {
  if (locale !== "en") return fields;
  return fields.map((f) => {
    const en = dict[f.key];
    if (!en) return f;
    return {
      ...f,
      label: en.label,
      placeholder: en.placeholder ?? (f.placeholder ? "" : f.placeholder),
      options: f.options.map((o) => ({ ...o, label: en.options?.[o.key] ?? o.label })),
    };
  });
}
