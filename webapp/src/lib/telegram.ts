/**
 * Telegram Bot — แจ้งเตือนเจ้าของเมื่อมีจอง / ลูกค้ายืนยัน
 */

import { getTelegramOwnerChatIds, getTelegramToken, sendTelegramReply } from "./telegram-config";

export async function sendTelegram(text: string) {
  const token = await getTelegramToken();
  const chats = await getTelegramOwnerChatIds();

  if (!token || !chats.length) return { ok: false, reason: "not_configured" };

  const results = await Promise.all(
    chats.map(async (chatId) => {
      const data = await sendTelegramReply(token, chatId, { message: text, html: true });
      return data.ok;
    })
  );

  return { ok: results.every(Boolean) };
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
