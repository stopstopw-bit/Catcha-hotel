import type { SiteConfig } from "./config-types";

/**
 * ร้านขอการ์ดอะไรในนัดอาบน้ำบ้าง — ตั้งในหน้าตั้งค่า › เปิด/ปิดฟีเจอร์ (หมวดข้อมูลก่อนรับน้อง)
 * ชุดเดียวกับ PetFlow (lib/intake-rules.ts) — ใช้กับแผ่นส่ง LINE (CustomerSendButtons)
 */
export type IntakeRules = {
  /** การ์ดของการเข้าพักที่ขอในนัดอาบน้ำด้วย (key ตาม GROOM_EXTRA_CARDS) */
  groomCards?: string[];
  /** การ์ดอัปเดตยากำจัดเห็บหมัด ขอรูปหลักฐานไหม — ไม่ตั้ง = แนบได้ ไม่บังคับ (ดู flea-update.ts) */
  fleaProof?: "off" | "optional" | "required";
};

/**
 * น้องกรอกข้อมูลก่อนเข้าพักแล้วจริงไหม — stayInfo ที่สร้างจากการ์ดอัปเดตยาเห็บหมัดอย่างเดียว (source "flea-update")
 * ยังไม่นับว่ากรอกฟอร์ม (ร้านยังขอฟอร์มเต็มได้)
 */
export function stayInfoDone(json?: string | null): boolean {
  if (!json) return false;
  try {
    return (JSON.parse(json) as { source?: string }).source !== "flea-update";
  } catch {
    return true;
  }
}

/** การ์ดของการเข้าพักที่ร้านเลือกให้ขอในนัดอาบน้ำได้ */
export const GROOM_EXTRA_CARDS = [
  { key: "vaccine", label: "สมุดวัคซีน" },
  { key: "consent", label: "กฎ + กดยินยอม" },
  { key: "idcard", label: "บัตรประชาชน" },
] as const;

/** ยังไม่ได้ตั้ง = แบบเดิมของ CatCha: นัดอาบน้ำขอสมุดวัคซีน + ข้อตกลงอาบน้ำ */
export const DEFAULT_GROOM_CARDS = ["vaccine", "consent"];

type WithRules = Pick<SiteConfig, "intakeRules"> | null | undefined;

export function groomCardsOf(cfg: WithRules): string[] {
  return cfg?.intakeRules?.groomCards ?? DEFAULT_GROOM_CARDS;
}

/** นัดอาบน้ำของร้านนี้ขอการ์ดนี้ด้วยไหม */
export function groomUsesCard(cfg: WithRules, part: string): boolean {
  return groomCardsOf(cfg).includes(part);
}
