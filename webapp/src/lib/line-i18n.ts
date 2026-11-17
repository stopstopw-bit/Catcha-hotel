/**
 * การ์ด LINE ภาษาอังกฤษ — สลับข้อความในการ์ด (Flex/ข้อความ) เป็นอังกฤษตอนส่ง สำหรับลูกค้าที่ใช้ภาษาอังกฤษ
 *
 * ข้อความของระบบใช้ฉบับอังกฤษตายตัวใน lib/card-en.ts (ทันที ได้คำเดิมทุกครั้ง)
 * AI แปลเฉพาะส่วนที่ไม่มีในตาราง เช่น ชื่อโปร/ข้อความที่ร้านพิมพ์เอง
 *
 * ทำไมแปลตอนส่ง (ไม่เขียนการ์ดอังกฤษแยกทุกใบ):
 * - การ์ดมีหลายสิบแบบ + ข้อความที่ร้านแก้เองใน /admin/cards → แปลจุดเดียวครอบคลุมทุกใบ รวมใบที่เพิ่มในอนาคต
 * - ภาษาที่ใช้: (1) แอดมินเลือกตอนส่ง (header x-card-lang จากป๊อปอัปพรีวิว) (2) ภาษาที่ลูกค้าตั้งไว้ (customers.language)
 *   ไม่มีทั้งสอง = ไทยเหมือนเดิม
 * - กันพลาด: ตัวเลข (ยอดเงิน เลขบัญชี เวลา) ในคำแปลต้องครบเหมือนต้นฉบับ ไม่ครบ = ใช้ข้อความไทยบรรทัดนั้น
 *   แปลไม่ได้ (ไม่มีคีย์ AI / โควต้าหมด / ช้า) = ส่งไทยเหมือนเดิม การ์ดไม่หาย
 * - ปุ่มแบบ "ส่งข้อความ" (action type message) ไม่แปลข้อความที่ส่งกลับ — ระบบแชทจับคำไทยอยู่ แปลแค่ป้ายปุ่ม
 */
import { aiProvider, generateAiText } from "./ai-text";
import { cardTextToEnglish } from "./card-en";

export type CardLang = "th" | "en";

const THAI = /[฀-๿]/;

/** แอดมินเลือกภาษาตอนส่ง — ป๊อปอัปพรีวิวแนบ header x-card-lang มากับคำขอส่ง */
export async function cardLangOverride(): Promise<CardLang | undefined> {
  try {
    const { headers } = await import("next/headers");
    const v = (await headers()).get("x-card-lang");
    return v === "en" || v === "th" ? v : undefined;
  } catch {
    // นอกคำขอ (เช่นงานเบื้องหลัง) — ไม่มี header
    return undefined;
  }
}

/** ภาษาที่ลูกค้าตั้งไว้ (ไม่มี = ไทย) */
export async function customerLangFor(lineUserId: string): Promise<CardLang> {
  try {
    const { findCustomerByLine } = await import("./customers-store");
    const c = await findCustomerByLine(lineUserId);
    return c?.language === "en" ? "en" : "th";
  } catch {
    return "th";
  }
}

/** ภาษาที่จะใช้ส่งหาคนนี้: แอดมินเลือก > ภาษาลูกค้า */
export async function resolveCardLang(lineUserId: string): Promise<CardLang> {
  return (await cardLangOverride()) ?? (await customerLangFor(lineUserId));
}

/** แบ่งผู้รับตามภาษา (ส่งกลุ่ม) — แอดมินเลือกภาษาไว้ = ทุกคนภาษานั้น */
export async function splitByCardLang(lineUserIds: string[]): Promise<Record<CardLang, string[]>> {
  const forced = await cardLangOverride();
  if (forced) return { th: forced === "th" ? lineUserIds : [], en: forced === "en" ? lineUserIds : [] };
  const out: Record<CardLang, string[]> = { th: [], en: [] };
  try {
    const { listCustomers } = await import("./customers-store");
    const en = new Set<string>();
    for (const c of await listCustomers()) {
      if (c.language !== "en") continue;
      if (c.lineUserId) en.add(c.lineUserId);
      for (const id of c.lineUserIds || []) en.add(id);
    }
    for (const id of lineUserIds) out[en.has(id) ? "en" : "th"].push(id);
  } catch {
    out.th = lineUserIds;
  }
  return out;
}

// ── แปลข้อความ ───────────────────────────────────────────────

/** คำแปลที่เคยได้ (จำไว้ในเครื่องเซิร์ฟเวอร์) — การ์ดเดิมซ้ำ ๆ ไม่ต้องเรียก AI ใหม่ */
const cache = new Map<string, string>();
const CACHE_MAX = 3000;

const SYSTEM = `You translate LINE message cards of a Thai cat hotel and cat grooming shop into natural, friendly English for foreign customers.
Rules:
- Input is a JSON array of Thai strings. Reply with ONLY a JSON array of the same length, same order, each item translated.
- Keep every number exactly as written (prices, amounts, account numbers, phone numbers, times, counts, dates' day numbers). Keep "฿", emoji, line breaks (\\n), URLs, codes and English words as they are.
- Thai Buddhist years (e.g. 2569) may be converted to the Christian year (subtract 543). Thai month names → English short month names.
- Names of people, cats, shops, rooms and products stay as written (transliterate Thai names to Latin letters only if the whole string is a name).
- Drop Thai politeness particles (ค่ะ/คะ/นะคะ/ครับ). "น้อง" before a cat's name is dropped or becomes the cat's name alone.
- Shop terms: มัดจำ = deposit, ยอดคงเหลือ = balance due, ฝากเลี้ยง/เข้าพัก = stay/boarding, อาบน้ำ = bath/grooming, เช็กอิน = check-in, เช็กเอาท์ = check-out, รับน้อง/ส่งน้องกลับบ้าน = pick-up/drop-off, ใบเสร็จ = receipt, บิล = bill, แต้ม = points, คอร์ส = package, คูปอง = coupon, สมุดวัคซีน = vaccination book, บัตรประชาชน = ID card.
- Short labels (buttons, headers) stay short.`;

/** ตัวเลขในข้อความ (ตัด , ออก) */
function numbersIn(s: string): string[] {
  return (s.match(/\d[\d,.]*\d|\d/g) || []).map((n) => n.replace(/,/g, "").replace(/\.$/, ""));
}

/** คำแปลต้องมีตัวเลขครบทุกตัว (ปี พ.ศ. แปลงเป็น ค.ศ. ได้) — ไม่ครบ = ไม่ใช้ */
export function numbersKept(src: string, out: string): boolean {
  const have = new Set(numbersIn(out));
  return numbersIn(src).every((n) => {
    if (have.has(n)) return true;
    const y = Number(n);
    return /^2[56]\d\d$/.test(n) && have.has(String(y - 543));
  });
}

function parseArray(text: string): unknown[] | null {
  const t = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    const v = JSON.parse(t.slice(start, end + 1));
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

/** แปลหลายข้อความในครั้งเดียว — คืน map ไทย→อังกฤษ (ข้อความที่แปลไม่ผ่านจะไม่อยู่ใน map) */
/** สาเหตุล่าสุดที่แปลไม่ได้ (พรีวิวหลังบ้านโชว์ให้ร้านเห็น) */
let lastError = "";
export function lastTranslateError() {
  return lastError;
}

export async function translateStrings(list: string[], timeoutMs = 25_000): Promise<Map<string, string>> {
  lastError = "";
  const out = new Map<string, string>();
  const todo: string[] = [];
  for (const s of new Set(list)) {
    const hit = cache.get(s);
    if (hit !== undefined) out.set(s, hit);
    else todo.push(s);
  }
  // แบ่งก้อนเล็ก ๆ แล้วแปลพร้อมกัน — เร็วกว่ารอทีละก้อน และคำตอบไม่ยาวจนขาด
  const batches: string[][] = [];
  for (let i = 0; i < todo.length; i += 20) batches.push(todo.slice(i, i + 20));
  await Promise.all(batches.map(async (batch) => {
    try {
      // รอไม่เกินที่กำหนด — ช้ากว่านั้นส่งไทยไปก่อน ลูกค้าไม่ต้องรอการ์ดนาน
      const res = await Promise.race([
        generateAiText({
          system: SYSTEM,
          prompt: JSON.stringify(batch),
          maxTokens: 4000,
          temperature: 0,
          fast: true,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
      const arr = res ? parseArray(res.text) : null;
      if (!res) {
        lastError = aiProvider() ? `AI ตอบช้าเกิน ${Math.round(timeoutMs / 1000)} วินาที` : "ยังไม่ได้ใส่คีย์ AI ใน Vercel";
        console.warn("[line-i18n]", lastError, batch.length);
      }
      if (!arr || arr.length !== batch.length) {
        if (res) {
          lastError = `AI ตอบผิดรูปแบบ (${res.provider})`;
          console.warn("[line-i18n] bad translate reply:", res.text.slice(0, 200));
        }
        return;
      }
      batch.forEach((src, j) => {
        const v = arr[j];
        if (typeof v !== "string" || !v.trim() || !numbersKept(src, v)) return;
        out.set(src, v);
        if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
        cache.set(src, v);
      });
    } catch (e) {
      lastError = `AI error: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`;
      console.warn("[line-i18n] translate failed:", lastError);
    }
  }));
  return out;
}

/** คีย์ที่เป็นข้อความให้ลูกค้าอ่าน */
const TEXT_KEYS = new Set(["text", "altText", "label", "displayText", "title"]);

type Visit = (holder: Record<string, unknown>, key: string, value: string) => void;

function walk(node: unknown, visit: Visit) {
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, visit));
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") {
      // ปุ่มส่งข้อความกลับ — ข้อความที่ส่งต้องคงเดิม (ระบบแชทจับคำนี้)
      if (k === "text" && obj.type === "message" && "label" in obj) continue;
      if (TEXT_KEYS.has(k) && THAI.test(v)) visit(obj, k, v);
    } else if (v && typeof v === "object") {
      walk(v, visit);
    }
  }
}

/** แปลการ์ด/ข้อความทั้งชุดเป็นภาษาอังกฤษ (สำเนาใหม่ ไม่แก้ของเดิม) — แปลไม่ได้ตรงไหนคงไทยไว้ */
export async function translateMessages<T>(messages: T[], timeoutMs?: number): Promise<T[]> {
  return (await translateMessagesInfo(messages, timeoutMs)).messages;
}

/** แปล + บอกว่าแปลได้กี่ข้อความจากทั้งหมด (พรีวิวหลังบ้านใช้บอกว่าแปลไม่สำเร็จ) */
export async function translateMessagesInfo<T>(
  messages: T[],
  timeoutMs?: number
): Promise<{ messages: T[]; total: number; translated: number }> {
  const copy = JSON.parse(JSON.stringify(messages)) as T[];
  // 1) ฉบับอังกฤษตายตัว (lib/card-en.ts) — ทันที ไม่ต้องรอ AI
  const fixed = new Map<string, { text: string; done: boolean }>();
  walk(copy, (_h, _k, v) => {
    if (!fixed.has(v)) fixed.set(v, cardTextToEnglish(v));
  });
  if (fixed.size === 0) return { messages: copy, total: 0, translated: 0 };
  // 2) เหลือไทย (ข้อความที่ร้านพิมพ์เอง เช่น ชื่อโปร) — ให้ AI แปลเฉพาะส่วนนั้น
  const rest = [...fixed].filter(([, r]) => !r.done).map(([s]) => s);
  // รอ AI ไม่นาน — ช้าเกินก็ส่งฉบับตายตัว (ส่วนที่ร้านพิมพ์เองคงไทย)
  const ai = rest.length ? await translateStrings(rest, timeoutMs ?? 10_000) : new Map<string, string>();
  let total = 0;
  let translated = 0;
  walk(copy, (h, k, v) => {
    total++;
    const r = fixed.get(v)!;
    const t = r.done ? r.text : ai.get(v) ?? r.text;
    if (r.done || ai.has(v)) translated++;
    h[k] = t;
  });
  return { messages: copy, total, translated };
}

/** ข้อความชุดนี้สำหรับภาษานี้ */
export async function localizeMessages<T>(messages: T[], lang: CardLang): Promise<T[]> {
  return lang === "en" ? translateMessages(messages) : messages;
}
