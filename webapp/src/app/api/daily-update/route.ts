import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionFrom } from "@/lib/auth";
import { getBooking } from "@/lib/bookings-store";
import { getSiteConfig } from "@/lib/config-store";
import { politeCat } from "@/lib/line";
import { bangkokToday } from "@/lib/bangkok-date";
import { generateAiText } from "@/lib/ai-text";
import { storeBroadcastImage } from "@/lib/broadcast-image-store";
import { uploadDataUrlToStorage } from "@/lib/supabase/storage";
import { getAppUrlFromEnv } from "@/lib/line-config";
import {
  cleanDailyPicks,
  missingRequired,
  dailyUpdateFallback,
  dailyUpdatePrompt,
  type DailyUpdateInput,
} from "@/lib/daily-update";

export const dynamic = "force-dynamic";

/** วันที่เท่าไหร่ของการเข้าพัก (นับวันเช็คอิน = วันที่ 1) */
function stayDayOf(checkin?: string): number | undefined {
  if (!checkin) return undefined;
  const a = Date.parse(`${checkin.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${bangkokToday()}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return undefined;
  return Math.round((b - a) / 86_400_000) + 1;
}

/**
 * อัปเดตน้องรายวัน (หลังบ้านเท่านั้น)
 *  action "generate" → ให้ AI เขียนข้อความจากเรื่องที่ติ๊ก (ไม่มีคีย์ AI = ข้อความสำเร็จรูป)
 *  action "photo"    → อัปรูปน้องขึ้นที่เก็บไฟล์ คืน URL สำหรับใส่หัวการ์ด
 * การส่งจริงไปที่ /api/bookings action "send_daily_update" (มีพรีวิวการ์ดก่อนเสมอ)
 */
export async function POST(req: NextRequest) {
  if (!(await getSessionFrom(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));

  if (body.action === "photo") {
    const dataUrl = String(body.imageData || "");
    if (!dataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "รูปไม่ถูกต้อง" }, { status: 400 });
    }
    const stored = await uploadDataUrlToStorage(`daily/${randomUUID()}`, dataUrl);
    if (!stored.startsWith("data:")) return NextResponse.json({ url: stored });
    const id = await storeBroadcastImage(dataUrl);
    return NextResponse.json({ url: `${getAppUrlFromEnv()}/api/line/broadcast-image/${id}` });
  }

  if (body.action !== "generate") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const b = await getBooking(String(body.id || ""));
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });
  const ids: string[] = Array.isArray(body.ids) && body.ids.length ? body.ids.map(String) : [b.id];
  const group = (await Promise.all(ids.map((x) => (x === b.id ? b : getBooking(x))))).filter(
    (x): x is NonNullable<typeof x> => !!x && x.customerName === b.customerName
  );
  const cfg = await getSiteConfig();
  const input: DailyUpdateInput = {
    catNames: [...new Set(group.map((x) => politeCat(x.catName)))],
    picks: cleanDailyPicks(body.picks),
    note: String(body.note || "").slice(0, 500),
    stayDay: b.service === "room" ? stayDayOf(b.checkin) : undefined,
    shopName: cfg.business.name,
    tone: cfg.cards?.dailyUpdate?.texts?.aiTone,
  };
  const missing = missingRequired(input.picks);
  if (missing.length) {
    return NextResponse.json({ error: `ยังไม่ได้เช็ค: ${missing.join(", ")}` }, { status: 400 });
  }

  try {
    const ai = await generateAiText(dailyUpdatePrompt(input));
    if (ai?.text) return NextResponse.json({ text: ai.text, ai: ai.provider });
    return NextResponse.json({ text: dailyUpdateFallback(input), ai: null, reason: ai ? "empty" : "no_key" });
  } catch (e) {
    // AI ล่ม/คีย์ผิด — ไม่ปล่อยให้พนักงานค้าง ให้ข้อความสำเร็จรูปไปแก้ต่อ
    return NextResponse.json({
      text: dailyUpdateFallback(input),
      ai: null,
      reason: "error",
      error: e instanceof Error ? e.message.slice(0, 200) : "AI error",
    });
  }
}
