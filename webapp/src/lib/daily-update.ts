/**
 * อัปเดตน้องรายวัน — พนักงานติ๊กว่าวันนี้น้องทำอะไรไปบ้าง แล้วให้ AI เรียบเรียงเป็นข้อความน่ารักๆ
 * ส่งหาลูกค้าในการ์ด LINE (ห้ามส่งข้อความเปล่า) · ไฟล์นี้ใช้ได้ทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์
 */

export type DailyChip = { id: string; label: string; /** เรื่องที่ต้องเล่าให้ลูกค้าสบายใจ ไม่ตกใจ */ watch?: boolean };
export type DailyGroup = {
  id: string;
  label: string;
  chips: DailyChip[];
  /** one = เลือกได้ข้อเดียว (แตะอีกข้อ = เปลี่ยน) · ไม่ใส่ = เลือกได้หลายข้อ */
  mode?: "one";
  /** ต้องเช็คก่อนให้ AI เขียน (ฉี่/อึ ต้องเช็คทุกวัน) */
  required?: boolean;
};

export const DAILY_GROUPS: DailyGroup[] = [
  {
    id: "eat",
    label: "กินข้าว",
    mode: "one",
    chips: [
      { id: "eat_all", label: "กินเก่ง หมดชาม" },
      { id: "eat_ok", label: "กินปกติ" },
      { id: "eat_less", label: "กินน้อยลง", watch: true },
      { id: "eat_none", label: "ยังไม่ค่อยกิน", watch: true },
    ],
  },
  {
    id: "food",
    label: "อาหารเสริม · น้ำ",
    chips: [
      { id: "treat", label: "ได้ขนมแมวเลีย" },
      { id: "water", label: "กินน้ำดี" },
      { id: "water_less", label: "กินน้ำน้อย", watch: true },
      { id: "meds", label: "ทานยาตามเวลา" },
    ],
  },
  {
    id: "pee",
    label: "ฉี่",
    mode: "one",
    required: true,
    chips: [
      { id: "pee_ok", label: "ฉี่ปกติ" },
      { id: "pee_less", label: "ฉี่น้อย", watch: true },
      { id: "pee_none", label: "ยังไม่ฉี่", watch: true },
      { id: "pee_out", label: "ฉี่นอกกระบะ", watch: true },
    ],
  },
  {
    id: "poo",
    label: "อึ",
    mode: "one",
    required: true,
    chips: [
      { id: "poo_ok", label: "อึปกติ" },
      { id: "poo_soft", label: "อึนิ่ม", watch: true },
      { id: "poo_hard", label: "อึแข็ง", watch: true },
      { id: "poo_none", label: "ยังไม่อึ", watch: true },
      { id: "poo_out", label: "อึนอกกระบะ", watch: true },
    ],
  },
  {
    id: "settle",
    label: "การปรับตัว · อารมณ์",
    chips: [
      { id: "relaxed", label: "ผ่อนคลาย อารมณ์ดี" },
      { id: "cuddle", label: "ขี้อ้อน เข้าหาคน" },
      { id: "explore", label: "เริ่มกล้าออกมาสำรวจ" },
      { id: "stress", label: "ยังเครียด กำลังปรับตัว", watch: true },
      { id: "hide", label: "ซ่อนตัว ยังไม่ออกจากห้อง", watch: true },
      { id: "hiss", label: "ขู่ / ฟ่อ", watch: true },
      { id: "swat", label: "ตะปบ ดุเวลาเข้าใกล้", watch: true },
      { id: "meow", label: "ร้องเรียกบ่อย", watch: true },
    ],
  },
  {
    id: "play",
    label: "กิจกรรม",
    chips: [
      { id: "view", label: "พาออกมาชมวิว" },
      { id: "walk", label: "ออกมาเดินเล่นนอกห้อง" },
      { id: "toy", label: "เล่นของเล่น" },
      { id: "wand", label: "เล่นไม้ตกแมว" },
      { id: "climb", label: "ปีนคอนโด / ลับเล็บ" },
      { id: "window", label: "นั่งดูวิวริมหน้าต่าง" },
      { id: "pet", label: "ให้ลูบ ให้อุ้ม" },
      { id: "sleep", label: "นอนหลับสบาย" },
    ],
  },
  {
    id: "care",
    label: "ดูแล",
    chips: [
      { id: "brush", label: "แปรงขน" },
      { id: "bath", label: "อาบน้ำ" },
      { id: "nails", label: "ตัดเล็บ" },
      { id: "eyes", label: "เช็ดตา/หู" },
      { id: "room_clean", label: "ทำความสะอาดห้อง" },
      { id: "litter_new", label: "เปลี่ยนทราย" },
      { id: "water_new", label: "เปลี่ยนน้ำสะอาด" },
    ],
  },
];

/** กลุ่มที่ต้องเช็คแต่ยังไม่ได้เลือก (ชื่อกลุ่ม) */
export function missingRequired(picks: string[]): string[] {
  return DAILY_GROUPS.filter((g) => g.required && !g.chips.some((c) => picks.includes(c.id))).map((g) => g.label);
}

/** แตะชิป — กลุ่มเลือกข้อเดียวจะสลับแทนข้อเดิม */
export function toggleDailyPick(picks: string[], id: string): string[] {
  if (picks.includes(id)) return picks.filter((x) => x !== id);
  const g = DAILY_GROUPS.find((x) => x.chips.some((c) => c.id === id));
  const drop = g?.mode === "one" ? new Set(g.chips.map((c) => c.id)) : new Set<string>();
  return [...picks.filter((x) => !drop.has(x)), id];
}

const CHIP_BY_ID = new Map(DAILY_GROUPS.flatMap((g) => g.chips.map((c) => [c.id, c] as const)));

/** เก็บเฉพาะ id ที่รู้จัก (กันข้อมูลแปลกๆ จากเบราว์เซอร์) */
export function cleanDailyPicks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(String))].filter((id) => CHIP_BY_ID.has(id));
}

export const DEFAULT_DAILY_TONE =
  "อบอุ่น เป็นกันเอง สุภาพ แทนตัวว่า \"แอดมิน\" เรียกเจ้าของว่า \"คุณพ่อคุณแม่\" ลงท้ายด้วย ค่ะ";

export type DailyUpdateInput = {
  catNames: string[];
  picks: string[];
  note?: string;
  /** เข้าพักวันที่เท่าไหร่ (1 = วันแรก) — ไม่รู้ = ไม่ใส่ */
  stayDay?: number;
  shopName?: string;
  tone?: string;
};

const catsText = (names: string[]) => {
  const n = names.filter(Boolean);
  return n.length <= 1 ? n[0] || "น้อง" : `${n.slice(0, -1).join(", ")} และ${n[n.length - 1]}`;
};

/** prompt ให้ AI — ห้ามแต่งเรื่องที่ไม่ได้ติ๊ก เพราะเป็นข้อมูลจริงของสัตว์เลี้ยงลูกค้า */
export function dailyUpdatePrompt(input: DailyUpdateInput): { system: string; prompt: string; maxTokens: number } {
  const picked = input.picks.map((id) => CHIP_BY_ID.get(id)).filter((c): c is DailyChip => !!c);
  const groups = DAILY_GROUPS.map((g) => {
    const items = g.chips.filter((c) => picked.includes(c));
    return items.length ? `- ${g.label}: ${items.map((c) => c.label).join(", ")}` : "";
  }).filter(Boolean);
  const watch = picked.filter((c) => c.watch).map((c) => c.label);

  const system = [
    `คุณคือแอดมินร้าน ${input.shopName || "โรงแรมแมว"} (โรงแรมแมว + อาบน้ำแมว) กำลังเขียนข้อความอัปเดตประจำวันของน้องแมวที่มาพัก ส่งให้เจ้าของทาง LINE`,
    `น้ำเสียง: ${input.tone?.trim() || DEFAULT_DAILY_TONE}`,
    "กติกา:",
    "- เขียนภาษาไทยแบบละเอียด 2-3 ย่อหน้าสั้นๆ ไล่ตามลำดับ: การกิน/น้ำ → ฉี่และอึ (เล่าแยกกันทั้งสองเรื่อง) → การปรับตัว/อารมณ์ → กิจกรรม → การดูแล",
    "- เล่าทุกเรื่องที่พนักงานติ๊กมา ห้ามตกหล่น และห้ามแต่งกิจกรรม อาการ หรือรายละเอียดที่ไม่ได้บอก",
    "- อีโมจิใช้น้อยมาก ไม่เกิน 2 ตัวทั้งข้อความ หรือไม่ใช้เลยก็ได้",
    "- เรื่องที่ต้องสังเกต (กินน้อย ฉี่/อึผิดปกติ เครียด ซ่อนตัว ขู่ ตะปบ) ให้เล่าตรงๆ แบบนุ่มนวล ไม่ทำให้ตกใจ และไม่วินิจฉัยโรค",
    "- ถ้าน้องมีอาการปรับตัว (เครียด ซ่อนตัว ยังไม่ออกจากห้อง ขู่ ฟ่อ ตะปบ กินน้อย ร้องเรียก) อธิบายสั้นๆ ว่าเป็นพฤติกรรมปกติของแมวที่ย้ายมาอยู่ที่ใหม่ แมวเป็นสัตว์ติดที่ มักใช้เวลาไม่กี่วันในการคุ้นกับกลิ่น เสียง และคนใหม่ๆ และบอกว่าแอดมินให้เวลาน้องปรับตัวตามจังหวะของน้อง ไม่บังคับ และเฝ้าดูใกล้ชิด",
    "- ถ้ากินน้อย/ไม่ฉี่/ไม่อึ ต่อเนื่องหลายวัน ให้บอกว่าแอดมินจะเฝ้าดูและแจ้งคุณพ่อคุณแม่ทันทีถ้ามีอะไรน่าห่วง (ห้ามขู่ให้กังวล)",
    "- ไม่ต้องขึ้นต้นด้วยคำทักทายชื่อลูกค้า ไม่ใส่ลิงก์ ไม่พูดเรื่องราคา/การชำระเงิน ไม่ใช้ markdown หรือหัวข้อ bullet",
    "- ตอบเฉพาะตัวข้อความที่จะส่ง ไม่ต้องมีคำอธิบายหรือเครื่องหมายคำพูดครอบ",
  ].join("\n");

  const prompt = [
    `น้องแมว: ${catsText(input.catNames)}`,
    input.stayDay ? `วันนี้เป็นวันที่ ${input.stayDay} ของการเข้าพัก` : "",
    groups.length ? `สิ่งที่น้องทำ/ได้รับการดูแลวันนี้:\n${groups.join("\n")}` : "",
    watch.length ? `เรื่องที่ต้องเล่าแบบนุ่มนวล: ${watch.join(", ")}` : "",
    input.note?.trim() ? `โน้ตเพิ่มจากพนักงาน: ${input.note.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, prompt, maxTokens: 900 };
}

/** ข้อความสำเร็จรูป — ใช้ตอนยังไม่ได้ใส่คีย์ AI หรือ AI ล่ม (พนักงานแก้ต่อเองได้) */
export function dailyUpdateFallback(input: DailyUpdateInput): string {
  const who = catsText(input.catNames);
  const picked = new Set(input.picks);
  const of = (g: string) =>
    DAILY_GROUPS.find((x) => x.id === g)!
      .chips.filter((c) => picked.has(c.id))
      .map((c) => c.label);
  const join = (a: string[]) => a.join(", ");
  const lines: string[] = [];
  const eat = [...of("eat"), ...of("food")];
  if (eat.length) lines.push(`การกิน: ${join(eat)}`);
  const pee = of("pee");
  const poo = of("poo");
  if (pee.length) lines.push(`ฉี่: ${join(pee)}`);
  if (poo.length) lines.push(`อึ: ${join(poo)}`);
  const settle = of("settle");
  if (settle.length) lines.push(`การปรับตัว: ${join(settle)}`);
  const play = of("play");
  if (play.length) lines.push(`กิจกรรม: ${join(play)}`);
  const care = of("care");
  if (care.length) lines.push(`การดูแล: ${join(care)}`);
  if (input.note?.trim()) lines.push(input.note.trim());
  const adjusting = ["stress", "hide", "hiss", "swat", "meow", "eat_less", "eat_none"].some((id) => picked.has(id));
  const day = input.stayDay ? ` (วันที่ ${input.stayDay} ของการเข้าพัก)` : "";
  return [
    `อัปเดต${who}ประจำวันนี้ค่ะ${day}`,
    lines.join("\n") || "วันนี้น้องสบายดีค่ะ",
    adjusting
      ? "อาการแบบนี้เป็นเรื่องปกติของแมวที่ย้ายมาที่ใหม่ค่ะ แอดมินให้เวลาน้องปรับตัวตามจังหวะของน้อง ไม่บังคับ และดูแลใกล้ชิดตลอด"
      : "",
    "หากคุณพ่อคุณแม่อยากรู้อะไรเพิ่ม ทักแอดมินได้เลยนะคะ",
  ]
    .filter(Boolean)
    .join("\n");
}
