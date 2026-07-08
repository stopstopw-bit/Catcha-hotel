import { NextRequest, NextResponse } from "next/server";
import { handleTelegramCommand } from "@/lib/telegram-commands";
import { getTelegramToken, sendTelegramReply } from "@/lib/telegram-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await getTelegramToken();
  if (!token) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  let body: { message?: { text?: string; chat?: { id?: number } } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_json" }, { status: 400 });
  }

  const message = body.message;
  if (!message?.text || message.chat?.id == null) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const chatId = message.chat.id;
  const text = String(message.text).trim();

  try {
    const result = await handleTelegramCommand(text, chatId);
    const sent = await sendTelegramReply(token, chatId, result);
    if (!sent.ok) {
      return NextResponse.json(
        { ok: false, reason: sent.description || "send_failed" },
        { status: 502 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, reason }, { status: 500 });
  }
}
