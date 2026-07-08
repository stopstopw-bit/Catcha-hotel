import { NextRequest, NextResponse } from "next/server";
import {
  getTelegramOwnerChatIds,
  getTelegramSource,
  getTelegramToken,
  getTelegramWebhookInfo,
  getTelegramWebhookUrl,
  isTelegramConfigured,
  setTelegramWebhook,
} from "@/lib/telegram-config";
import { getSecrets, saveTelegramSecrets } from "@/lib/secrets-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAdmin(body: { adminCode?: string }) {
  const secret = process.env.NEXT_PUBLIC_ADMIN_CODE;
  return !secret || body.adminCode === secret;
}

function parseChatIds(raw: string) {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET(req: NextRequest) {
  const configured = await isTelegramConfigured();
  const source = await getTelegramSource();
  const ownerChatIds = await getTelegramOwnerChatIds();
  const webhookUrl = getTelegramWebhookUrl(
    req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL
  );

  let webhook = null;
  if (configured) {
    const token = await getTelegramToken();
    if (token) {
      const info = await getTelegramWebhookInfo(token);
      webhook = {
        ok: info.ok,
        url: info.result?.url || "",
        pending: info.result?.pending_update_count ?? 0,
        lastError: info.result?.last_error_message || null,
        expectedUrl: webhookUrl,
        matches: Boolean(webhookUrl && info.result?.url === webhookUrl),
      };
    }
  }

  const secrets = await getSecrets();
  const hasDb = Boolean(secrets.telegram?.botToken);

  return NextResponse.json({
    configured,
    source: source === "none" && hasDb ? "database" : source,
    ownerChatIds,
    webhookUrl,
    webhook,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!checkAdmin(body)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const botToken = String(body.botToken || "").trim();
  if (!botToken) {
    return NextResponse.json(
      { ok: false, message: "วาง Bot Token จาก @BotFather" },
      { status: 400 }
    );
  }

  const ownerChatIds = parseChatIds(String(body.ownerChatIds || ""));
  const webhookUrl = getTelegramWebhookUrl(
    String(body.appUrl || process.env.NEXT_PUBLIC_APP_URL || "")
  );

  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, message: "ไม่พบ URL เว็บ — ตั้ง NEXT_PUBLIC_APP_URL ใน Vercel" },
      { status: 400 }
    );
  }

  try {
    await saveTelegramSecrets({ botToken, ownerChatIds });

    const hook = await setTelegramWebhook(botToken, webhookUrl);
    if (!hook.ok) {
      return NextResponse.json({
        ok: false,
        message: `บันทึก Token แล้ว แต่ตั้ง Webhook ไม่สำเร็จ: ${hook.description || "unknown"}`,
      });
    }

    const info = await getTelegramWebhookInfo(botToken);

    return NextResponse.json({
      ok: true,
      message:
        `✅ ตั้งค่า Telegram สำเร็จ\n` +
        `Webhook: ${webhookUrl}\n` +
        `Chat ID รับแจ้งเตือน: ${ownerChatIds.length ? ownerChatIds.join(", ") : "ยังไม่ใส่ — ทัก /start ใน bot แล้ว copy Chat ID"}`,
      webhook: {
        url: info.result?.url,
        pending: info.result?.pending_update_count ?? 0,
      },
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}
