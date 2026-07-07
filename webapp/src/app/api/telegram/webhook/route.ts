import { NextRequest, NextResponse } from "next/server";
import {
  buildStartReply,
  getTelegramWebhookInfo,
  getTelegramWebhookUrl,
  parseTelegramCommand,
  sendTelegramToChat,
  setTelegramWebhook,
} from "@/lib/telegram";

/**
 * Telegram webhook — รับคำสั่งจากเจ้าของ
 * /start → แสดง chat id สำหรับตั้งค่า TELEGRAM_OWNER_CHAT_IDS
 * /today → ดูนัดวันนี้ (ต่อ DB ทีหลัง)
 */
export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN missing" }, { status: 503 });
  }

  const register = req.nextUrl.searchParams.get("register") === "1";
  const webhookUrl = getTelegramWebhookUrl();

  if (register) {
    if (!webhookUrl) {
      return NextResponse.json(
        { ok: false, error: "Set NEXT_PUBLIC_APP_URL on Vercel first" },
        { status: 400 }
      );
    }

    const setResult = await setTelegramWebhook(webhookUrl);
    const info = await getTelegramWebhookInfo();
    return NextResponse.json({
      ok: setResult.ok,
      webhookUrl,
      setWebhook: setResult.data,
      webhookInfo: info.data,
    });
  }

  const info = await getTelegramWebhookInfo();
  return NextResponse.json({
    ok: info.ok,
    expectedWebhookUrl: webhookUrl || null,
    webhookInfo: info.data,
  });
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN missing" }, { status: 503 });
  }

  let body: { message?: { text?: string; chat?: { id?: number } } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const message = body.message;
  if (!message?.text || message.chat?.id == null) {
    return NextResponse.json({ ok: true, skipped: "non_text_message" });
  }

  const chatId = message.chat.id;
  const { command } = parseTelegramCommand(String(message.text));

  let reply = "";
  if (command === "/start") {
    reply = buildStartReply(chatId);
  } else if (command === "/today") {
    reply = "📅 นัดวันนี้ — ต่อฐานข้อมูลแล้วจะแสดงรายการจริง";
  } else if (command === "/help") {
    reply = "คำสั่ง:\n/start — ดู Chat ID\n/today — นัดวันนี้\n/help — วิธีใช้";
  } else if (command.startsWith("/")) {
    reply = "ไม่รู้จักคำสั่งนี้ พิมพ์ /help ดูคำสั่งที่ใช้ได้";
  } else {
    reply = "พิมพ์ /help ดูคำสั่ง";
  }

  const sent = await sendTelegramToChat(chatId, reply);
  if (!sent.ok) {
    console.error("telegram sendMessage failed", sent.status, sent.data);
    return NextResponse.json(
      { ok: false, error: "send_failed", detail: sent.data },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
