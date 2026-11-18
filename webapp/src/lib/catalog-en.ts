/**
 * ชื่อภาษาอังกฤษของข้อความที่ร้านพิมพ์เอง (ชื่อโปร คอร์ส แพ็กเกจ ฯลฯ) สำหรับลูกค้าที่เลือก English
 * เก็บใน site_config.textEn (key = ข้อความไทย) — ไม่ต้องเพิ่มคอลัมน์ในฐานข้อมูล
 * ข้อความไหนยังไม่มีคำแปล → ให้ AI แปลครั้งเดียวแล้วจำไว้ · ร้านแก้คำแปลเองได้ (manual) ระบบจะไม่แปลทับ
 */
import { getSiteConfig, updateSiteConfig } from "./config-store";
import { listPackageOffers } from "./package-shop-store";
import { listPromos } from "./promos-store";
import { translateStrings } from "./line-i18n";

const THAI = /[ก-ฺเ-๛]/;

export type CatalogEntry = { th: string; en: string; manual?: boolean; kind: string };

/** ข้อความที่ลูกค้าเห็นในแอป — ชื่อ/รายละเอียดโปร คอร์ส แพ็กเกจ */
async function catalogTexts(): Promise<{ text: string; kind: string; presetEn?: string }[]> {
  const [offers, promos] = await Promise.all([
    listPackageOffers().catch(() => []),
    listPromos().catch(() => []),
  ]);
  const out: { text: string; kind: string; presetEn?: string }[] = [];
  const add = (text: string | undefined, kind: string, presetEn?: string) => {
    const t = (text || "").trim();
    if (t && THAI.test(t)) out.push({ text: t, kind, presetEn: presetEn?.trim() || undefined });
  };
  for (const o of offers) {
    add(o.name, "คอร์ส/แพ็กเกจ");
    add(o.description, "รายละเอียดคอร์ส");
    o.itemLabels?.forEach((l) => add(l, "รายการในคอร์ส"));
  }
  for (const p of promos) {
    // ร้านใส่ชื่ออังกฤษไว้เองแล้ว (ไม่ใช่ก๊อปไทย) → ใช้ของร้าน
    const ten = p.title.en && p.title.en !== p.title.th && !THAI.test(p.title.en) ? p.title.en : undefined;
    const ben = p.body.en && p.body.en !== p.body.th && !THAI.test(p.body.en) ? p.body.en : undefined;
    add(p.title.th, "ชื่อโปร", ten);
    add(p.body.th, "รายละเอียดโปร", ben);
  }
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.text) ? false : (seen.add(x.text), true)));
}

let running: Promise<Record<string, string>> | null = null;

/** แผนที่ ไทย→อังกฤษ ของทุกข้อความในแคตตาล็อก (แปลที่ยังขาดให้ แล้วจำไว้) */
export async function getCatalogEn(): Promise<Record<string, string>> {
  if (running) return running;
  running = (async () => {
    const [cfg, texts] = await Promise.all([getSiteConfig(), catalogTexts()]);
    const stored = cfg.textEn || {};
    const map: Record<string, string> = {};
    const add: Record<string, { en: string; manual?: boolean }> = {};
    const missing: string[] = [];
    for (const t of texts) {
      const s = stored[t.text];
      if (s?.en) map[t.text] = s.en;
      else if (t.presetEn) map[t.text] = t.presetEn;
      else missing.push(t.text);
    }
    if (missing.length) {
      const tr = await translateStrings(missing, 12_000).catch(() => new Map<string, string>());
      for (const [th, en] of tr) {
        map[th] = en;
        add[th] = { en };
      }
      if (Object.keys(add).length) await updateSiteConfig({ textEn: add }).catch(() => {});
    }
    return map;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** หลังบ้าน: รายการทั้งหมดพร้อมคำแปล ให้ร้านตรวจ/แก้ */
export async function listCatalogEn(): Promise<CatalogEntry[]> {
  const map = await getCatalogEn();
  const [cfg, texts] = await Promise.all([getSiteConfig(), catalogTexts()]);
  const stored = cfg.textEn || {};
  return texts.map((t) => ({ th: t.text, en: map[t.text] || "", manual: !!stored[t.text]?.manual, kind: t.kind }));
}

/** หลังบ้าน: บันทึกคำแปลที่ร้านแก้เอง (ว่าง = ให้ระบบแปลใหม่) */
export async function saveCatalogEn(edits: { th: string; en: string }[]) {
  const cfg = await getSiteConfig();
  const next: Record<string, { en: string; manual?: boolean }> = { ...(cfg.textEn || {}) };
  for (const e of edits) {
    const th = String(e.th || "").trim();
    if (!th) continue;
    const en = String(e.en || "").trim();
    if (en) next[th] = { en, manual: true };
    else delete next[th];
  }
  // แทนทั้งก้อน (ลบได้) — merge ปกติลบ key ไม่ได้
  const { replaceSiteConfig } = await import("./config-store");
  await replaceSiteConfig({ ...cfg, textEn: next });
}
