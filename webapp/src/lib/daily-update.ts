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
  "เหมือนพนักงานร้านพิมพ์แชทเองในมือถือ สั้น เป็นกันเอง ใช้คำพูดธรรมดา ลงท้าย ค่ะ/ค่า/นะคะ";

/** ตัวอย่างข้อความจริงที่ร้านพิมพ์เอง — AI เลียนแบบสำนวน (แก้/เพิ่มได้ที่ /admin/cards › อัปเดตน้องวันนี้) */
export const DEFAULT_DAILY_EXAMPLES = `สวัสดีค่ะ อัพเดทน้องเหมียวเข้าวันนี้นะคะ
เมื่อคืนน้องมีเข้าห้องน้ำไป อึและฉี่เรียบร้อยค่ะ
มีกินอาหารไปเกือบๆหมดถ้วยนะคะ
เช้าวันนี้ โดดออกมาเองเล่นค่า แวะทักทายเพื่อนๆห้องอื่นด้วย ไม่ขู่ด้วยนะคะ 🥰
---
สวัสดีค่ะ อัพเดทน้องมาจิช่วงเย็นนี้นะคะ
ช่วงกลางวันน้องมีกินอาหารไปนิดหน่อยค่ะ
ยังไม่มีเข้าห้องน้ำเพิ่มเติมนะคะ
ช่วงบ่ายและเย็นพาออกมาวิ่งเล่น ชมวิวเรียบร้อยค่า
---
สวัสดีค่า อัพเดทน้องมาจิช่วงเช้านี้นะคะ
เมื่อคืนน้องมีเข้าห้องน้ำ อึและฉี่แล้วเรียบร้อยค่ะ มีกินอาหารไปนิดเดียวนะคะ เช้าวันนี้ เปลี่ยนอาหารใหม่ให้แล้วค่า
เช้านี้พาออกมาวิ่งเล่นเรียบร้อยนะคะ ยังไม่ค่อยกล้าเดินไปไกลๆห้องเท่าไหร่ค่ะ แต่ยังร่าเริงดีไม่มีอาการเครียดแล้วนะคะ
---
สวัสดีค่า อัพเดทน้องมาจิช่วงเย็นนะคะ
น้องยังไม่มีเข้าห้องน้ำ และกินอาหารเพิ่มเติมค่า มีออกมาเล่นบ้างแล้วนะคะ ถ้าอุ้มมานั่งตักจะไม่กลัวเท่าไหร่ค่ะ แต่ยังมีตกใจเสียงรอบข้างอยู่ รวมๆแล้วน้องดูผ่อนคลายขึ้นกว่าตอนแรกนะคะ คิดว่าพรุ่งนี้น่าจะชิวขึ้นค่ะ 🥰`;

export type DailyPeriod = "morning" | "evening";
export const DAILY_PERIOD_LABEL: Record<DailyPeriod, string> = { morning: "ช่วงเช้า", evening: "ช่วงเย็น" };
/** เดาช่วงจากเวลาไทยตอนนี้ — ก่อนบ่ายโมง = เช้า */
export function guessDailyPeriod(now = new Date()): DailyPeriod {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", hourCycle: "h23" }).format(now)
  );
  return h < 13 ? "morning" : "evening";
}

export type DailyUpdateInput = {
  catNames: string[];
  picks: string[];
  note?: string;
  /** เข้าพักวันที่เท่าไหร่ (1 = วันแรก) — ไม่รู้ = ไม่ใส่ */
  stayDay?: number;
  shopName?: string;
  tone?: string;
  /** ตัวอย่างข้อความที่ร้านเขียนเอง คั่นด้วยบรรทัด --- */
  examples?: string;
  period?: DailyPeriod;
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
  const examples = (input.examples?.trim() || DEFAULT_DAILY_EXAMPLES)
    .split(/\n-{3,}\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8);

  const system = [
    `คุณคือพนักงานร้าน ${input.shopName || "โรงแรมแมว"} (โรงแรมแมว) กำลังพิมพ์แชท LINE อัปเดตน้องแมวที่มาพักให้เจ้าของ`,
    `สำนวน: ${input.tone?.trim() || DEFAULT_DAILY_TONE}`,
    "เขียนให้เหมือนตัวอย่างข้อความจริงของร้านด้านล่างนี้ให้มากที่สุด ทั้งความยาว การขึ้นบรรทัด คำลงท้าย และการสะกด (เช่น อัพเดท ค่า นะคะ) ให้อ่านแล้วเหมือนคนพิมพ์เอง ไม่ใช่ AI:",
    ...examples.map((e, i) => `<ตัวอย่าง ${i + 1}>\n${e}\n</ตัวอย่าง ${i + 1}>`),
    "กติกา:",
    "- ไม่ใช่รายงานเป็นข้อๆ แต่เป็นการเล่าเรื่องให้เจ้าของเห็นภาพว่าน้องเป็นยังไงบ้าง และอ่านแล้วสบายใจ",
    "- ขึ้นต้นแบบตัวอย่าง: สวัสดีค่ะ อัพเดทน้อง<ชื่อ>ช่วงเช้า/เย็นนี้นะคะ แล้วเล่าต่อ 4-6 บรรทัดสั้นๆ",
    "- เล่าทุกเรื่องที่พนักงานติ๊กมา ใช้ภาษาพูดง่ายๆ (เช่น 'ฉี่ปกติ + อึปกติ' → 'อึและฉี่เรียบร้อยค่ะ') บรรยายท่าทางอารมณ์ได้เท่าที่ข้อมูลรองรับ แต่ห้ามแต่งเหตุการณ์ที่ไม่ได้บอก",
    "- ทำให้เจ้าของสบายใจ: เรื่องที่ไม่ดี (กินน้อย ยังไม่อึ ขู่ ซ่อนตัว ยังกลัว) เล่าตรงๆ แบบนุ่มนวล แล้วตามด้วยมุมที่ทำให้อุ่นใจ เช่น เป็นเรื่องปกติของน้องแมวที่เพิ่งย้ายมาที่ใหม่ ร้านค่อยๆให้เวลาน้องไม่บังคับ คอยดูอยู่ตลอด หรือความคืบหน้าเล็กๆที่ดี",
    "- ปิดท้ายด้วยประโยคอุ่นใจสั้นๆ 1 ประโยคเหมือนตัวอย่าง (เช่น 'รวมๆแล้วน้องดูผ่อนคลายขึ้นนะคะ คิดว่าพรุ่งนี้น่าจะชิวขึ้นค่ะ' หรือ 'น้องสบายดีไม่ต้องห่วงนะคะ') ให้สอดคล้องกับข้อมูลจริง",
    "- ภาษาพูดแบบคนพิมพ์แชท ไม่ทางการ ไม่สอน ไม่อธิบายยาว ไม่ใช้คำว่า 'แอดมิน' 'คุณพ่อคุณแม่' ถ้าตัวอย่างไม่ได้ใช้",
    "- อีโมจิไม่เกิน 1-2 ตัว ไว้ท้ายข้อความ หรือไม่ใส่ก็ได้",
    "- ไม่ใส่ลิงก์ ไม่พูดเรื่องเงิน ไม่วินิจฉัยโรค ไม่ใช้ markdown ตอบเฉพาะข้อความที่จะส่ง",
  ].join("\n");

  const prompt = [
    `น้องแมว: ${catsText(input.catNames)}`,
    `ช่วงที่อัพเดท: ${DAILY_PERIOD_LABEL[input.period || "morning"]}`,
    input.stayDay ? `วันนี้เป็นวันที่ ${input.stayDay} ของการเข้าพัก` : "",
    groups.length ? `สิ่งที่พนักงานติ๊ก:\n${groups.join("\n")}` : "",
    input.note?.trim() ? `โน้ตเพิ่มจากพนักงาน: ${input.note.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { system, prompt, maxTokens: 600 };
}

/** ข้อความสำเร็จรูป — ใช้ตอนยังไม่ได้ใส่คีย์ AI หรือ AI ล่ม (พนักงานแก้ต่อเองได้) */
export function dailyUpdateFallback(input: DailyUpdateInput): string {
  const who = catsText(input.catNames);
  const picked = new Set(input.picks);
  const of = (g: string) =>
    DAILY_GROUPS.find((x) => x.id === g)!
      .chips.filter((c) => picked.has(c.id))
      .map((c) => c.label);
  const lines: string[] = [`สวัสดีค่ะ อัพเดท${who}${DAILY_PERIOD_LABEL[input.period || "morning"]}นี้นะคะ`];
  const pee = of("pee");
  const poo = of("poo");
  if (picked.has("pee_ok") && picked.has("poo_ok")) lines.push("น้องมีเข้าห้องน้ำ อึและฉี่เรียบร้อยค่ะ");
  else if (pee.length || poo.length) lines.push(`${[...pee, ...poo].join(" ")}นะคะ`);
  const eat = [...of("eat"), ...of("food")];
  if (eat.length) lines.push(`${eat.join(" ")}ค่ะ`);
  const rest = [...of("play"), ...of("settle"), ...of("care")];
  if (rest.length) lines.push(`${rest.join(" ")}ค่า`);
  if (input.note?.trim()) lines.push(input.note.trim());
  const adjusting = ["stress", "hide", "hiss", "swat", "meow", "eat_less", "eat_none", "poo_none", "pee_none"].some((id) =>
    picked.has(id)
  );
  lines.push(
    adjusting
      ? "น้องเพิ่งมาที่ใหม่ อาจต้องใช้เวลาปรับตัวนิดนึงนะคะ ทางร้านค่อยๆให้เวลาน้อง และคอยดูอยู่ตลอดค่ะ"
      : "รวมๆแล้วน้องสบายดี ไม่ต้องห่วงนะคะ"
  );
  return lines.join("\n");
}
