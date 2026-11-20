import { NextRequest, NextResponse } from "next/server";
import { deleteGame, getGame, listGames, listPlays, saveGame } from "@/lib/games-store";
import { sanitizeCampaign, type GameCampaign, type GameStats } from "@/lib/game-types";
import { listAllCoupons } from "@/lib/coupons-store";
import { getBroadcastAudience, listCustomers } from "@/lib/customers-store";
import type { CustomerTier } from "@/lib/customer-tier";
import { getLineCredentials } from "@/lib/line-config";
import { buildGameUrl } from "@/lib/liff-urls";
import { multicastLineMessage } from "@/lib/line";
import { buildGameInviteFlex } from "@/lib/game-card";
import { getSiteConfig } from "@/lib/config-store";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";


/** หลังบ้าน: แคมเปญทั้งหมด + สถิติ + ลิงก์ LIFF สำหรับทำ QR */
export async function GET() {
  const [games, plays, coupons, customers, creds] = await Promise.all([
    listGames(),
    listPlays(),
    listAllCoupons(),
    listCustomers(),
    getLineCredentials(),
  ]);
  const custById = new Map(customers.map((c) => [c.id, c]));
  const couponById = new Map(coupons.map((c) => [c.id, c]));
  const stats: Record<string, GameStats> = {};
  for (const g of games) {
    const mine = plays.filter((p) => p.campaignId === g.id);
    const firstPlay = new Map<string, string>();
    for (const p of mine) if (!firstPlay.has(p.customerId)) firstPlay.set(p.customerId, p.createdAt);
    let newMembers = 0;
    for (const [cid, at] of firstPlay) {
      const created = custById.get(cid)?.createdAt;
      if (created && created >= g.createdAt && created <= at) newMembers++;
    }
    const perPrize: Record<string, number> = {};
    let couponsIssued = 0;
    let couponsUsed = 0;
    let valueUsed = 0;
    for (const p of mine) {
      perPrize[p.prizeId] = (perPrize[p.prizeId] || 0) + 1;
      if (p.couponId) {
        couponsIssued++;
        const c = couponById.get(p.couponId);
        if (c?.status === "used") {
          couponsUsed++;
          valueUsed += c.amount;
        }
      }
    }
    stats[g.id] = {
      plays: mine.length,
      players: firstPlay.size,
      newMembers,
      couponsIssued,
      couponsUsed,
      valueUsed,
      perPrize,
      recent: mine
        .slice(-20)
        .reverse()
        .map((p) => ({
          at: p.createdAt,
          customerName: custById.get(p.customerId)?.name || "-",
          prize: p.prizeLabel,
          kind: p.prizeKind,
        })),
    };
  }
  const liffId = creds?.liffId || "";
  return NextResponse.json({
    games,
    stats,
    links: Object.fromEntries(games.map((g) => [g.id, liffId ? buildGameUrl(liffId, g.id) : ""])),
    liffReady: Boolean(liffId),
  });
}

/** สร้าง / แก้แคมเปญ */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const game = sanitizeCampaign((body.game || {}) as Partial<GameCampaign>);
  if (!game) {
    return NextResponse.json({ error: "ใส่ชื่อเกม และรางวัลอย่างน้อย 2 ช่อง" }, { status: 400 });
  }
  if (!game.prizes.some((p) => p.weight > 0)) {
    return NextResponse.json({ error: "ตั้งโอกาสได้รางวัลอย่างน้อย 1 ช่อง" }, { status: 400 });
  }
  const games = await saveGame(game);
  return NextResponse.json({ ok: true, games });
}

/** เปิด/ปิด · ลบ · ส่งการ์ดชวนเล่นทาง LINE */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const game = await getGame(String(body.gameId || ""));
  if (!game) return NextResponse.json({ error: "ไม่พบเกมนี้" }, { status: 404 });

  if (action === "set_active") {
    const games = await saveGame({ ...game, active: body.active === true });
    return NextResponse.json({ ok: true, games });
  }

  if (action === "delete") {
    const games = await deleteGame(game.id);
    return NextResponse.json({ ok: true, games });
  }

  if (action === "blast") {
    const liffId = (await getLineCredentials())?.liffId;
    if (!liffId) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้ง LIFF ID — ไป Admin → ติดตั้ง ก่อน" }, { status: 400 });
    }
    if (!game.active) return NextResponse.json({ error: "เปิดเกมก่อนค่อยส่งการ์ดนะคะ" }, { status: 400 });
    const tier = (body.tier || "all") as CustomerTier | "all";
    const { recipients, skippedNoLine, skippedNoConsent } = await getBroadcastAudience(tier);
    const lineIds = recipients.map((c) => c.lineUserId).filter(Boolean) as string[];
    const flex = buildGameInviteFlex(game, buildGameUrl(liffId, game.id), (await getSiteConfig()).cards?.game);
    let sent = 0;
    if (lineIds.length) sent = (await multicastLineMessage(lineIds, [flex])).sent;
    await sendTelegram(
      formatBookingTelegram("🎡 ส่งการ์ดชวนเล่นเกม", {
        เกม: game.title,
        ส่งสำเร็จ: String(sent),
        ข้ามไม่มีLINE: String(skippedNoLine.length),
        ข้ามไม่รับข่าว: String(skippedNoConsent.length),
      })
    );
    return NextResponse.json({ ok: true, sent, skippedNoLine: skippedNoLine.length, skippedNoConsent: skippedNoConsent.length });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
