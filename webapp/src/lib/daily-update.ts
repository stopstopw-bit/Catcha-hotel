/**
 * อัปเดตน้องรายวัน — พนักงานติ๊กว่าวันนี้น้องทำอะไรไปบ้าง แล้วให้ AI เรียบเรียงเป็นข้อความน่ารักๆ
 * ส่งหาลูกค้าในการ์ด LINE (ห้ามส่งข้อความเปล่า) · ไฟล์นี้ใช้ได้ทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์
 */

export type DailyChip = { id: string; label: string; /** เรื่องที่ต้องเล่าให้ลูกค้าสบายใจ ไม่ตกใจ */ watch?: boolean };
export type DailyGroup = { id: string; label: string; chips: DailyChip[] };

export const DAILY_GROUPS: DailyGroup[] = [
  {
    id: "eat",
    label: "กินข้าว",
    chips: [
      { id: "eat_all", label: "กินเก่ง หมดชาม" },
      { id: "eat_ok", label: "กินปกติ" },
      { id: "eat_less", label: "กินน้อยลงนิดนึง", watch: true },
      { id: "treat", label: "ได้ขนมแมวเลีย" },
      { id: "water", label: "กินน้ำดี" },
    ],
  },
  {
    id: "litter",
    label: "ขับถ่าย",
    chips: [
      { id: "pee_ok", label: "ฉี่ปกติ" },
      { id: "poo_ok", label: "อึปกติ" },
      { id: "poo_soft", label: "อึนิ่มนิดหน่อย", watch: true },
      { id: "poo_none", label: "วันนี้ยังไม่อึ", watch: true },
    ],
  },
  {
    id: "mood",
    label: "อารมณ์ · เล่น",
    chips: [
      { id: "play", label: "เล่นซน" },
      { id: "cuddle", label: "ขี้อ้อน" },
      { id: "happy", label: "อารมณ์ดี" },
      { id: "sleep", label: "นอนหลับสบาย" },
      { id: "window", label: "นั่งดูวิวริมหน้าต่าง" },
      { id: "shy", label: "ยังขี้อาย กำลังปรับตัว", watch: true },
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
      { id: "meds", label: "ทานยาตามเวลา" },
      { id: "room_clean", label: "ทำความสะอาดห้อง" },
      { id: "litter_new", label: "เปลี่ยนทราย" },
    ],
  },
];

const CHIP_BY_ID = new Map(DAILY_GROUPS.flatMap((g) => g.chips.map((c) => [c.id, c] as const)));

/** เก็บเฉพาะ id ที่รู้จัก (กันข้อมูลแปลกๆ จากเบราว์เซอร์) */
export function cleanDailyPicks(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(String))].filter((id) => CHIP_BY_ID.has(id));
}

export const DEFAULT_DAILY_TONE =
  "อบอุ่น เป็นกันเอง น่ารัก แทนตัวว่า \"แอดมิน\" เรียกเจ้าของว่า \"คุณพ่อคุณแม่\" ลงท้ายด้วย ค่ะ";

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
export function dailyUpdatePrompt(input: DailyUpdateInput): { system: string; prompt: string } {
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
    "- เขียนภาษาไทย 3-5 ประโยค เป็นย่อหน้าเดียวหรือสองย่อหน้าสั้นๆ ใส่อีโมจิน่ารัก 2-4 ตัว",
    "- เล่าเฉพาะเรื่องที่พนักงานบอกมาเท่านั้น ห้ามแต่งกิจกรรม อาการ หรือรายละเอียดที่ไม่ได้บอก",
    "- เรื่องที่ต้องสังเกต (เช่น กินน้อยลง อึนิ่ม ยังไม่อึ ขี้อาย) ให้เล่าตรงๆ แบบนุ่มนวล บอกว่าแอดมินดูแลใกล้ชิดอยู่ ไม่ทำให้ตกใจ และไม่วินิจฉัยโรค",
    "- ไม่ต้องขึ้นต้นด้วยคำทักทายชื่อลูกค้า ไม่ใส่ลิงก์ ไม่พูดเรื่องราคา/การชำระเงิน",
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

  return { system, prompt };
}

/** ข้อความสำเร็จรูป — ใช้ตอนยังไม่ได้ใส่คีย์ AI หรือ AI ล่ม (พนักงานแก้ต่อเองได้) */
export function dailyUpdateFallback(input: DailyUpdateInput): string {
  const who = catsText(input.catNames);
  const picked = new Set(input.picks);
  const line = (g: string) =>
    DAILY_GROUPS.find((x) => x.id === g)!
      .chips.filter((c) => picked.has(c.id))
      .map((c) => c.label);
  const parts: string[] = [];
  const eat = line("eat");
  const litter = line("litter");
  const mood = line("mood");
  const care = line("care");
  if (eat.length) parts.push(`เรื่องอาหาร ${eat.join(" ")} 🍽️`);
  if (litter.length) parts.push(`ขับถ่าย ${litter.join(" ")}`);
  if (mood.length) parts.push(`วันนี้${mood.join(" ")} 😺`);
  if (care.length) parts.push(`แอดมิน${care.join(" ")}ให้เรียบร้อยแล้ว ✨`);
  if (input.note?.trim()) parts.push(input.note.trim());
  const day = input.stayDay ? ` (วันที่ ${input.stayDay} ของการเข้าพัก)` : "";
  return [
    `อัปเดต${who}ประจำวันนี้ค่ะ${day} 🐾`,
    parts.length ? parts.join(" · ") : "วันนี้น้องสบายดี แอดมินดูแลใกล้ชิดตลอดค่ะ",
    "หากคุณพ่อคุณแม่อยากรู้อะไรเพิ่ม ทักแอดมินได้เลยนะคะ 🧡",
  ].join("\n");
}
