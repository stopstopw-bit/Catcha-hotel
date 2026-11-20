import { NextRequest, NextResponse } from "next/server";
import { resolveCustomerLineId, noCustomerSessionResponse } from "@/lib/customer-session";
import { featureOff } from "@/lib/features-server";
import { findCustomerByLine } from "@/lib/customers-store";
import { isProfileComplete } from "@/lib/customer-tier";
import { getGame, lastPlay, playGame, playsLeft } from "@/lib/games-store";
import { toPublicGame } from "@/lib/game-types";
import { bangkokToday } from "@/lib/bangkok-date";
import { formatBookingTelegram } from "@/lib/telegram";
import { sendTelegramLater } from "@/lib/after-response";

export const dynamic = "force-dynamic";

/** หน้าเกมฝั่งลูกค้า: ข้อมูลแคมเปญ (ไม่ส่งโอกาสได้รางวัล) + สิทธิ์ที่เหลือของคนที่เปิดอยู่ */
export async function GET(req: NextRequest) {
  const blocked = await featureOff("games");
  if (blocked) return blocked;
  const id = req.nextUrl.searchParams.get("g")?.trim() || "";
  const game = id ? await getGame(id) : undefined;
  if (!game) return NextResponse.json({ found: false });

  const lineUserId = await resolveCustomerLineId(req, req.nextUrl.searchParams.get("lineUserId"));
  const found = lineUserId ? await findCustomerByLine(lineUserId) : undefined;
  // ต้องสมัครครบ (เบอร์ + น้อง) ถึงเล่นได้ — เกมนี้มีไว้เก็บข้อมูลลูกค้าใหม่
  const cust = found && isProfileComplete(found) ? found : undefined;
  const last = cust ? await lastPlay(game, cust.id) : undefined;
  return NextResponse.json({
    found: true,
    game: toPublicGame(game, bangkokToday()),
    registered: Boolean(cust),
    playsLeft: cust ? await playsLeft(game, cust.id) : game.playsPerCustomer,
    last: last ? { label: last.prizeLabel, kind: last.prizeKind, amount: last.amount } : null,
  });
}

/** ลูกค้ากดหมุน / ขูด — สุ่มและแจกรางวัลฝั่งเซิร์ฟเวอร์เท่านั้น */
export async function POST(req: NextRequest) {
  const blocked = await featureOff("games");
  if (blocked) return blocked;
  const body = await req.json().catch(() => ({}));
  const gameId = String(body.gameId || "").trim();
  const lineUserId = await resolveCustomerLineId(req, body.lineUserId);
  if (!lineUserId) return noCustomerSessionResponse();
  if (!gameId) return NextResponse.json({ error: "missing_game" }, { status: 400 });
  const game = await getGame(gameId);
  if (!game) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const cust = await findCustomerByLine(lineUserId);
  if (!cust || !isProfileComplete(cust)) return NextResponse.json({ error: "no_customer" }, { status: 403 });

  const res = await playGame(game, { id: cust.id, name: cust.name, lineUserId: cust.lineUserId || lineUserId });
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.error === "busy" ? 503 : 409 });
  }
  if (res.result.kind !== "none") {
    sendTelegramLater(
      formatBookingTelegram(game.type === "wheel" ? "🎡 ลูกค้าหมุนวงล้อได้รางวัล" : "🎟️ ลูกค้าขูดบัตรได้รางวัล", {
        ลูกค้า: cust.name,
        แคมเปญ: game.title,
        รางวัล: res.result.label,
        ...(res.result.couponCode ? { รหัสคูปอง: res.result.couponCode } : {}),
      })
    );
  }
  return NextResponse.json({ ok: true, result: res.result });
}
