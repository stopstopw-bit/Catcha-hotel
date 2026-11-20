/**
 * เกมลุ้นรางวัล (วงล้อ / ขูดบัตร) ฝั่งเซิร์ฟเวอร์ — สุ่มรางวัล นับสิทธิ์ต่อคน แจกคูปอง/แต้ม และสรุปสถิติ
 *
 * แคมเปญอยู่ใน site_config.games · การเล่นแต่ละครั้ง = 1 แถวในตาราง game_plays
 * กันเล่นเกินสิทธิ์ (กดรัวๆ / เปิด 2 จอพร้อมกัน): id ของแถวคือ "แคมเปญ|ลูกค้า|รอบ|ครั้งที่"
 * สองคำขอที่นับได้ครั้งที่เดียวกัน จะเขียนได้แค่แถวเดียว อีกคำขอชน primary key แล้วถูกปฏิเสธ
 */
import { randomInt } from "crypto";
import { getSupabase } from "./supabase/server";
import { ensureMigration } from "./migrations";
import { getSiteConfig, updateSiteConfig } from "./config-store";
import { bangkokToday } from "./bangkok-date";
import { issueCoupon } from "./coupons-store";
import { addPoints } from "./points-store";
import type { GameCampaign, GamePlayResult, GamePrize } from "./game-types";

export type GamePlay = {
  id: string;
  campaignId: string;
  customerId: string;
  period: string;
  prizeId: string;
  prizeLabel: string;
  prizeKind: string;
  amount: number;
  couponId?: string;
  createdAt: string;
};

type PlayRow = {
  id: string;
  campaign_id: string;
  customer_id: string;
  period: string;
  prize_id: string | null;
  prize_label: string | null;
  prize_kind: string | null;
  amount: number | null;
  coupon_id: string | null;
  created_at: string;
};

const memPlays: GamePlay[] = [];

function rowToPlay(r: PlayRow): GamePlay {
  return {
    id: r.id,
    campaignId: r.campaign_id,
    customerId: r.customer_id,
    period: r.period,
    prizeId: r.prize_id || "",
    prizeLabel: r.prize_label || "",
    prizeKind: r.prize_kind || "none",
    amount: Number(r.amount) || 0,
    couponId: r.coupon_id || undefined,
    createdAt: r.created_at,
  };
}

function missingTable(msg: string): boolean {
  return /game_plays|relation .* does not exist|schema cache/i.test(msg);
}

// ── แคมเปญ (site_config.games) ──

export async function listGames(): Promise<GameCampaign[]> {
  return (await getSiteConfig()).games || [];
}

export async function getGame(id: string): Promise<GameCampaign | undefined> {
  return (await listGames()).find((g) => g.id === id);
}

export async function saveGame(game: GameCampaign): Promise<GameCampaign[]> {
  const list = await listGames();
  const i = list.findIndex((g) => g.id === game.id);
  // ไม่ให้แก้วันสร้าง (ใช้นับลูกค้าใหม่จากเกม)
  const next = i >= 0 ? list.map((g, k) => (k === i ? { ...game, createdAt: g.createdAt } : g)) : [game, ...list];
  await updateSiteConfig({ games: next });
  return next;
}

export async function deleteGame(id: string): Promise<GameCampaign[]> {
  const next = (await listGames()).filter((g) => g.id !== id);
  await updateSiteConfig({ games: next });
  return next;
}

// ── ประวัติการเล่น ──

async function selectPlays(filter: { campaignId?: string; customerId?: string }): Promise<GamePlay[] | null> {
  const sb = getSupabase();
  if (!sb) {
    return memPlays.filter(
      (p) => (!filter.campaignId || p.campaignId === filter.campaignId) && (!filter.customerId || p.customerId === filter.customerId)
    );
  }
  const out: GamePlay[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    let q = sb.from("game_plays").select("*");
    if (filter.campaignId) q = q.eq("campaign_id", filter.campaignId);
    if (filter.customerId) q = q.eq("customer_id", filter.customerId);
    const { data, error } = await q.order("created_at", { ascending: true }).range(from, from + 999);
    if (error) {
      // ยังไม่มีตาราง = ยังไม่มีใครเล่น
      if (missingTable(error.message || "")) return [];
      return null;
    }
    out.push(...((data as PlayRow[] | null) || []).map(rowToPlay));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function listPlays(campaignId?: string): Promise<GamePlay[]> {
  return (await selectPlays({ campaignId })) || [];
}

function periodKey(game: GameCampaign) {
  return game.period === "day" ? bangkokToday() : "all";
}

/** ลูกค้าคนนี้เล่นแคมเปญนี้ได้อีกกี่ครั้ง (ในรอบปัจจุบัน) */
export async function playsLeft(game: GameCampaign, customerId: string): Promise<number> {
  const mine = (await selectPlays({ campaignId: game.id, customerId })) || [];
  const used = mine.filter((p) => p.period === periodKey(game)).length;
  return Math.max(0, game.playsPerCustomer - used);
}

/** รางวัลล่าสุดของลูกค้าในแคมเปญนี้ (ไว้โชว์ตอนกลับมาเปิดหน้าเกมอีกครั้ง) */
export async function lastPlay(game: GameCampaign, customerId: string): Promise<GamePlay | undefined> {
  const mine = (await selectPlays({ campaignId: game.id, customerId })) || [];
  return mine[mine.length - 1];
}

/** สุ่มรางวัลตามน้ำหนัก — รางวัลที่แจกครบจำนวนแล้วไม่สุ่มได้อีก · ใช้ crypto.randomInt ไม่ใช้ Math.random */
export function pickPrize(prizes: GamePrize[], wonCount: Record<string, number>): GamePrize | undefined {
  const pool = prizes.filter((p) => p.weight > 0 && !(p.stock && (wonCount[p.id] || 0) >= p.stock));
  // ใช้หน่วยละเอียด 1/1000 ให้น้ำหนักทศนิยม (เช่น 0.5%) สุ่มได้ถูก
  const scaled = pool.map((p) => Math.round(p.weight * 1000));
  const total = scaled.reduce((s, w) => s + w, 0);
  if (total <= 0) return prizes.find((p) => p.kind === "none");
  let r = randomInt(total);
  for (let i = 0; i < pool.length; i++) {
    if (r < scaled[i]) return pool[i];
    r -= scaled[i];
  }
  return pool[pool.length - 1];
}

export type PlayError = "closed" | "not_started" | "ended" | "no_plays_left" | "no_prize" | "busy";

/**
 * ลูกค้าเล่น 1 ครั้ง — จองสิทธิ์ (เขียนแถว) ก่อน แล้วค่อยแจกรางวัล
 * คืน error ถ้าแคมเปญปิด/หมดสิทธิ์ หรือมีอีกคำขอกำลังเล่นสิทธิ์เดียวกันอยู่
 */
export async function playGame(
  game: GameCampaign,
  customer: { id: string; name: string; lineUserId?: string }
): Promise<{ ok: true; result: GamePlayResult } | { ok: false; error: PlayError }> {
  const today = bangkokToday();
  if (!game.active) return { ok: false, error: "closed" };
  if (game.startDate && today < game.startDate) return { ok: false, error: "not_started" };
  if (game.endDate && today > game.endDate) return { ok: false, error: "ended" };

  const all = await selectPlays({ campaignId: game.id });
  if (all === null) return { ok: false, error: "busy" };
  const period = periodKey(game);
  const usedNow = all.filter((p) => p.customerId === customer.id && p.period === period).length;
  if (usedNow >= game.playsPerCustomer) return { ok: false, error: "no_plays_left" };

  const wonCount: Record<string, number> = {};
  for (const p of all) wonCount[p.prizeId] = (wonCount[p.prizeId] || 0) + 1;
  const prize = pickPrize(game.prizes, wonCount);
  if (!prize) return { ok: false, error: "no_prize" };

  const play: GamePlay = {
    id: `${game.id}|${customer.id}|${period}|${usedNow + 1}`,
    campaignId: game.id,
    customerId: customer.id,
    period,
    prizeId: prize.id,
    prizeLabel: prize.label,
    prizeKind: prize.kind,
    amount: prize.kind === "none" ? 0 : prize.amount,
    createdAt: new Date().toISOString(),
  };

  const sb = getSupabase();
  if (sb) {
    const row = {
      id: play.id,
      campaign_id: play.campaignId,
      customer_id: play.customerId,
      period: play.period,
      prize_id: play.prizeId,
      prize_label: play.prizeLabel,
      prize_kind: play.prizeKind,
      amount: play.amount,
      created_at: play.createdAt,
    };
    let { error } = await sb.from("game_plays").insert(row);
    if (error && missingTable(error.message || "") && (await ensureMigration("game_plays.setup"))) {
      ({ error } = await sb.from("game_plays").insert(row));
    }
    if (error) {
      // ชน primary key = อีกคำขอใช้สิทธิ์ครั้งนี้ไปแล้ว
      return { ok: false, error: /duplicate|unique|23505/i.test(`${error.message} ${error.code}`) ? "no_plays_left" : "busy" };
    }
  } else {
    if (memPlays.some((p) => p.id === play.id)) return { ok: false, error: "no_plays_left" };
    memPlays.push(play);
  }

  const result: GamePlayResult = {
    prizeId: prize.id,
    label: prize.label,
    kind: prize.kind,
    amount: play.amount,
    playsLeft: Math.max(0, game.playsPerCustomer - usedNow - 1),
  };

  if (prize.kind === "coupon" && prize.amount > 0) {
    const coupon = await issueCoupon({
      customerId: customer.id,
      amount: prize.amount,
      reason: `${game.title}: ${prize.label}`,
      expiresInDays: prize.validDays || 30,
    });
    result.couponCode = coupon.code;
    result.validDays = prize.validDays || 30;
    play.couponId = coupon.id;
    if (sb) await sb.from("game_plays").update({ coupon_id: coupon.id }).eq("id", play.id);
  } else if (prize.kind === "points" && prize.amount > 0 && customer.lineUserId) {
    await addPoints(
      customer.lineUserId,
      prize.amount,
      `รางวัลเกม: ${game.title}`,
      `Game prize: ${game.title}`,
      customer.name,
      customer.id
    );
  }

  return { ok: true, result };
}
