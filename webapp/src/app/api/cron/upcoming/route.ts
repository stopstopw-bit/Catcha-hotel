import { NextRequest, NextResponse } from "next/server";
import { sendTelegram } from "@/lib/telegram";
import { verifyCronSecret } from "@/lib/cron-auth";
import { bangkokNowTime, bangkokToday } from "@/lib/bangkok-date";
import { getSiteConfig } from "@/lib/config-store";
import { buildUpcomingReminderMessage } from "@/lib/upcoming-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron ทุกชั่วโมงตรง — เตือนเข้า Telegram อีกครั้งก่อนถึงเวลานัด ~3 ชั่วโมง
 * (อาบน้ำ / มาส่งน้อง / มารับน้อง + รับ-ส่ง + งานเพิ่มในบิล) · ไม่มีนัดเข้าช่วง = ไม่ส่ง
 * ทดสอบเอง: ?hour=7 = ทำเหมือนตอนนี้ 07:xx น.
 */
export async function GET(req: NextRequest) {
  const denied = verifyCronSecret(req);
  if (denied) return denied;

  const today = bangkokToday();
  const q = req.nextUrl.searchParams.get("hour");
  const hour = q != null && /^\d{1,2}$/.test(q) ? Number(q) : Number(bangkokNowTime().slice(0, 2));
  try {
    const cfg = await getSiteConfig();
    const msg = await buildUpcomingReminderMessage(today, hour, {
      roomName: (id) => cfg.rooms.find((r) => r.id === id)?.name || id || "-",
    });
    if (!msg) return NextResponse.json({ ok: true, today, hour, sent: false });
    const res = await sendTelegram(msg);
    return NextResponse.json({ ok: res.ok, today, hour, sent: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
