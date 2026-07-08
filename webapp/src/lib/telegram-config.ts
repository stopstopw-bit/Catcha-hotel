import { getSecrets } from "./secrets-store";

export type TelegramReply = {
  message: string;
  html?: boolean;
  keyboard?: boolean;
};

export async function getTelegramToken(): Promise<string | null> {
  const env = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (env) return env;
  const secrets = await getSecrets();
  return secrets.telegram?.botToken || null;
}

export async function getTelegramOwnerChatIds(): Promise<string[]> {
  const env = (process.env.TELEGRAM_OWNER_CHAT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (env.length) return env;
  const secrets = await getSecrets();
  return secrets.telegram?.ownerChatIds || [];
}

export async function getTelegramSource(): Promise<"env" | "database" | "none"> {
  if (process.env.TELEGRAM_BOT_TOKEN?.trim()) return "env";
  const secrets = await getSecrets();
  if (secrets.telegram?.botToken) return "database";
  return "none";
}

export async function isTelegramConfigured() {
  return Boolean(await getTelegramToken());
}

export function getTelegramWebhookUrl(baseUrl?: string) {
  const base = (baseUrl || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (!base) return "";
  return `${base}/api/telegram/webhook`;
}
export async function telegramApi<T>(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<T>;
}

export async function getTelegramWebhookInfo(token: string) {
  return telegramApi<{
    ok: boolean;
    result?: {
      url?: string;
      has_custom_certificate?: boolean;
      pending_update_count?: number;
      last_error_message?: string;
    };
  }>(token, "getWebhookInfo");
}

export async function setTelegramWebhook(token: string, webhookUrl: string) {
  return telegramApi<{ ok: boolean; description?: string }>(token, "setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}

export const TELEGRAM_REPLY_KEYBOARD = {
  keyboard: [
    [{ text: "/today" }, { text: "/queue" }],
    [{ text: "/month" }, { text: "/sales" }],
    [{ text: "/finance" }, { text: "/help" }],
  ],
  resize_keyboard: true,
};

export async function sendTelegramReply(
  token: string,
  chatId: number | string,
  reply: TelegramReply
) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: reply.message,
  };
  if (reply.html) body.parse_mode = "HTML";
  if (reply.keyboard) body.reply_markup = TELEGRAM_REPLY_KEYBOARD;

  const data = await telegramApi<{ ok: boolean; description?: string }>(
    token,
    "sendMessage",
    body
  );
  return data;
}
