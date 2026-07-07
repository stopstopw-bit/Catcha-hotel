/**
 * Telegram Bot — แจ้งเตือนเจ้าของเมื่อมีจอง / ลูกค้ายืนยัน
 * ตั้งค่า: TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_CHAT_IDS (คั่นด้วย comma)
 */

const TELEGRAM_API = "https://api.telegram.org";

export type TelegramCommand = {
  command: string;
  payload?: string;
};

/** รองรับ /start, /start@BotName, /start payload */
export function parseTelegramCommand(text: string): TelegramCommand {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return { command: "" };

  const [head, ...rest] = trimmed.split(/\s+/);
  const command = head.split("@")[0].toLowerCase();
  const payload = rest.join(" ").trim();
  return payload ? { command, payload } : { command };
}

export function getTelegramWebhookUrl() {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
  ).replace(/\/$/, "");
  return base ? `${base}/api/telegram/webhook` : "";
}

async function telegramApi<T = unknown>(
  method: string,
  body?: Record<string, unknown>
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false as const, reason: "not_configured" as const };

  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as T & {
    ok?: boolean;
    description?: string;
  };

  return {
    ok: res.ok && data.ok !== false,
    status: res.status,
    data,
  };
}

export async function sendTelegramToChat(
  chatId: number | string,
  text: string
) {
  return telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  });
}

export async function sendTelegram(text: string) {
  const chats = (process.env.TELEGRAM_OWNER_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (!process.env.TELEGRAM_BOT_TOKEN || !chats.length) {
    return { ok: false, reason: "not_configured" };
  }

  const results = await Promise.all(
    chats.map((chatId) => sendTelegramToChat(chatId, text))
  );

  return { ok: results.every((r) => r.ok) };
}

export async function getTelegramWebhookInfo() {
  return telegramApi("getWebhookInfo");
}

export async function setTelegramWebhook(url: string) {
  return telegramApi("setWebhook", {
    url,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

export function buildStartReply(chatId: number | string) {
  return (
    `🐱 สวัสดีจาก CatCha Hotel Bot\n\n` +
    `Chat ID ของคุณ: <code>${chatId}</code>\n` +
    `นำไปใส่ใน <code>TELEGRAM_OWNER_CHAT_IDS</code> บน Vercel เพื่อรับแจ้งเตือนจอง\n\n` +
    `คำสั่ง: /today /help`
  );
}

export function formatBookingTelegram(
  title: string,
  detail: Record<string, string>
) {
  const lines = Object.entries(detail)
    .map(([k, v]) => `<b>${k}</b>: ${v}`)
    .join("\n");
  return `🐱 <b>CatCha Hotel</b>\n${title}\n\n${lines}`;
}
