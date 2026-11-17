import { NextRequest, NextResponse } from "next/server";
import { customerLangFor, lastTranslateError, translateMessagesInfo } from "@/lib/line-i18n";

export const runtime = "nodejs";
// แปลการ์ดยาว ๆ อาจใช้เวลา — ให้เวลาเกินค่าเริ่มต้น
export const maxDuration = 60;

/**
 * หลังบ้าน: แปลการ์ดในป๊อปอัปพรีวิวเป็นภาษาอังกฤษ (ให้เห็นก่อนส่งจริง)
 * POST { messages } → { messages } · POST { lineUserId } → { lang } (ภาษาที่ลูกค้าตั้งไว้)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.lineUserId === "string" && body.lineUserId.trim()) {
    return NextResponse.json({ lang: await customerLangFor(body.lineUserId.trim()) });
  }
  const messages = Array.isArray(body.messages) ? body.messages.slice(0, 5) : [];
  if (messages.length === 0) return NextResponse.json({ error: "no_messages" }, { status: 400 });
  const r = await translateMessagesInfo(messages, 15_000);
  // แปลไม่ได้เลย (ไม่มีคีย์ AI / โควต้าหมด / ช้าเกิน) — บอกหน้าพรีวิวให้ขึ้นเตือน
  if (r.total > 0 && r.translated === 0) {
    return NextResponse.json({ error: "translate_failed", reason: lastTranslateError() }, { status: 502 });
  }
  return NextResponse.json({ messages: r.messages, total: r.total, translated: r.translated });
}
