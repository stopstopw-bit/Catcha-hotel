/**
 * เกมลุ้นรางวัลใน LINE (วงล้อ / ขูดบัตร) — ชนิดข้อมูลที่ใช้ทั้งหน้าลูกค้าและหลังบ้าน (ห้าม import ของฝั่งเซิร์ฟเวอร์)
 *
 * แคมเปญเก็บใน site_config.games · ประวัติการเล่นเก็บในตาราง game_plays (migration game_plays.setup)
 * รางวัลใช้ระบบเดิม: คูปองส่วนลด (coupons) หรือแต้ม (points) — ไม่มีระบบรางวัลแยก
 */

/** sessionStorage: หน้าที่จะพากลับไปหลังสมัครสมาชิกเสร็จ (มาจากหน้าเกม) */
export const AFTER_REGISTER_KEY = "catcha.afterRegister";

export type GameType = "wheel" | "scratch";

export type GamePrizeKind = "coupon" | "points" | "none";

export type GamePrize = {
  id: string;
  /** ข้อความบนช่องวงล้อ / ใต้บัตรขูด เช่น "ลด 50 บาท" */
  label: string;
  kind: GamePrizeKind;
  /** coupon = บาท · points = แต้ม · none = ไม่ใช้ */
  amount: number;
  /** อายุคูปอง (วัน) — ไม่ตั้ง = 30 */
  validDays?: number;
  /** โอกาสได้ (น้ำหนัก ใช้เทียบกันในแคมเปญ ใส่เป็น % ก็ได้) */
  weight: number;
  /** แจกได้สูงสุดกี่รางวัลตลอดแคมเปญ — ไม่ตั้ง = ไม่จำกัด · หมดแล้วจะไม่สุ่มได้อีก */
  stock?: number;
  /** สีช่องบนวงล้อ (ไม่ตั้ง = สลับสีของร้าน) */
  color?: string;
};

export type GameCampaign = {
  id: string;
  type: GameType;
  title: string;
  /** คำโปรยใต้หัวข้อ */
  subtitle?: string;
  active: boolean;
  /** YYYY-MM-DD ตามเวลาไทย — ไม่ตั้ง = เริ่มทันที / ไม่มีวันจบ */
  startDate?: string;
  endDate?: string;
  /** เล่นได้กี่ครั้งต่อคน */
  playsPerCustomer: number;
  /** นับสิทธิ์ตลอดแคมเปญ หรือรีเซ็ตทุกวัน */
  period: "campaign" | "day";
  prizes: GamePrize[];
  createdAt: string;
};

/** ข้อมูลแคมเปญที่ส่งให้หน้าลูกค้า — ไม่ส่งน้ำหนัก/จำนวนคงเหลือ */
export type PublicGame = {
  id: string;
  type: GameType;
  title: string;
  subtitle?: string;
  prizes: { id: string; label: string; kind: GamePrizeKind; color?: string }[];
  /** open | not_started | ended | closed */
  status: "open" | "not_started" | "ended" | "closed";
  startDate?: string;
  endDate?: string;
  playsPerCustomer: number;
  period: "campaign" | "day";
};

export type GamePlayResult = {
  prizeId: string;
  label: string;
  kind: GamePrizeKind;
  amount: number;
  couponCode?: string;
  validDays?: number;
  playsLeft: number;
};

/** สถิติต่อแคมเปญ (หน้าหลังบ้าน) */
export type GameStats = {
  plays: number;
  players: number;
  /** ลูกค้าที่สมัครสมาชิกหลังเปิดแคมเปญ แล้วเล่นเกมนี้ (นับเป็นลูกค้าใหม่จากเกม) */
  newMembers: number;
  couponsIssued: number;
  couponsUsed: number;
  valueUsed: number;
  perPrize: Record<string, number>;
  recent: { at: string; customerName: string; prize: string; kind: string }[];
};

export const GAME_TYPE_LABEL: Record<GameType, string> = {
  wheel: "วงล้อนำโชค",
  scratch: "ขูดบัตรลุ้นรางวัล",
};

/** สีช่องวงล้อสลับกัน — โทนน้ำผึ้ง/น้ำตาล/เขียวของร้าน */
export const WHEEL_COLORS = ["#EBC583", "#FFFDFA", "#9FB79A", "#F4ECE0", "#C7A583", "#FBF6EF"];

export function newGameId(prefix = "G") {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

/** แคมเปญตั้งต้นตอนกดสร้างใหม่ — ร้านแก้ได้ทุกช่อง */
export function defaultGameCampaign(type: GameType): GameCampaign {
  const prize = (label: string, kind: GamePrizeKind, amount: number, weight: number, stock?: number): GamePrize => ({
    id: newGameId("P"),
    label,
    kind,
    amount,
    weight,
    ...(kind === "coupon" ? { validDays: 30 } : {}),
    ...(stock ? { stock } : {}),
  });
  return {
    id: newGameId(),
    type,
    title: type === "wheel" ? "หมุนวงล้อ ลุ้นส่วนลด" : "ขูดบัตร ลุ้นส่วนลด",
    subtitle: "สมาชิกเล่นฟรี 1 ครั้ง ได้รางวัลเข้ากระเป๋าคูปองทันที",
    active: false,
    playsPerCustomer: 1,
    period: "campaign",
    prizes: [
      prize("ลด 30 บาท", "coupon", 30, 40),
      prize("ลด 50 บาท", "coupon", 50, 25),
      prize("ลด 100 บาท", "coupon", 100, 10),
      prize("ลด 200 บาท", "coupon", 200, 2, 5),
      prize("ไว้ลุ้นใหม่นะ", "none", 0, 23),
    ],
    createdAt: new Date().toISOString(),
  };
}

/** โอกาสได้แต่ละรางวัลเป็น % (ไว้โชว์หลังบ้าน) */
export function prizeChances(prizes: GamePrize[]): Record<string, number> {
  const total = prizes.reduce((s, p) => s + Math.max(0, p.weight || 0), 0);
  const out: Record<string, number> = {};
  for (const p of prizes) out[p.id] = total > 0 ? (Math.max(0, p.weight || 0) / total) * 100 : 0;
  return out;
}

/** สถานะแคมเปญ ณ วันนี้ (วันที่ไทย YYYY-MM-DD) */
export function gameStatus(c: GameCampaign, today: string): PublicGame["status"] {
  if (!c.active) return "closed";
  if (c.startDate && today < c.startDate) return "not_started";
  if (c.endDate && today > c.endDate) return "ended";
  return "open";
}

export function toPublicGame(c: GameCampaign, today: string): PublicGame {
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    subtitle: c.subtitle,
    prizes: c.prizes.map((p) => ({ id: p.id, label: p.label, kind: p.kind, color: p.color })),
    status: gameStatus(c, today),
    startDate: c.startDate,
    endDate: c.endDate,
    playsPerCustomer: c.playsPerCustomer,
    period: c.period,
  };
}

/** ล้างค่าที่หลังบ้านส่งมา — กันตัวเลขติดลบ/ว่าง ก่อนบันทึก */
export function sanitizeCampaign(raw: Partial<GameCampaign>): GameCampaign | null {
  const type: GameType = raw.type === "scratch" ? "scratch" : "wheel";
  const title = String(raw.title || "").trim().slice(0, 80);
  if (!title) return null;
  const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const prizes: GamePrize[] = (Array.isArray(raw.prizes) ? raw.prizes : [])
    .map((p): GamePrize | null => {
      const label = String(p?.label || "").trim().slice(0, 30);
      if (!label) return null;
      const kind: GamePrizeKind = p.kind === "coupon" || p.kind === "points" ? p.kind : "none";
      const amount = kind === "none" ? 0 : Math.max(0, Math.round(Number(p.amount) || 0));
      const stock = Math.round(Number(p.stock) || 0);
      const validDays = Math.round(Number(p.validDays) || 0);
      return {
        id: String(p.id || newGameId("P")).slice(0, 40),
        label,
        kind: kind !== "none" && amount <= 0 ? "none" : kind,
        amount,
        weight: Math.max(0, Number(p.weight) || 0),
        ...(kind === "coupon" ? { validDays: validDays > 0 ? Math.min(validDays, 365) : 30 } : {}),
        ...(stock > 0 ? { stock } : {}),
        ...(p.color ? { color: String(p.color).slice(0, 20) } : {}),
      };
    })
    .filter((p): p is GamePrize => Boolean(p))
    .slice(0, 12);
  if (prizes.length < 2) return null;
  return {
    id: String(raw.id || newGameId()).slice(0, 40),
    type,
    title,
    subtitle: String(raw.subtitle || "").trim().slice(0, 140) || undefined,
    active: raw.active === true,
    startDate: date(raw.startDate),
    endDate: date(raw.endDate),
    playsPerCustomer: Math.min(50, Math.max(1, Math.round(Number(raw.playsPerCustomer) || 1))),
    period: raw.period === "day" ? "day" : "campaign",
    prizes,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}
