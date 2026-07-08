import { bookingsForDate, listBookings } from "@/lib/bookings-store";
import { searchCustomers, listCustomers } from "@/lib/customers-store";
import { todayFinance, monthFinance } from "@/lib/finance-store";
import { salesSummary } from "@/lib/invoices-store";
import { adminDashboardStats, bookingsForMonth } from "@/lib/admin-stats";
import { getTelegramCredentials } from "@/lib/telegram-config";

import {
  parseTelegramCommand,
  sendTelegramToChat,
  TELEGRAM_ACTION_BUTTONS,
  TELEGRAM_MENU_BUTTONS,
} from "@/lib/telegram";

const MENU_BUTTON_SET = new Set<string>(Object.values(TELEGRAM_MENU_BUTTONS));
const ACTION_BUTTON_SET = new Set<string>(Object.values(TELEGRAM_ACTION_BUTTONS));

const MENU_TO_COMMAND: Record<string, string> = {
  [TELEGRAM_MENU_BUTTONS.today]: "/today",
  [TELEGRAM_MENU_BUTTONS.queue]: "/queue",
  [TELEGRAM_MENU_BUTTONS.month]: "/month",
  [TELEGRAM_MENU_BUTTONS.sales]: "/sales",
  [TELEGRAM_MENU_BUTTONS.finance]: "/finance",
  [TELEGRAM_MENU_BUTTONS.customers]: "/customers",
  [TELEGRAM_MENU_BUTTONS.help]: "/help",
};

export function isTelegramMenuButton(text: string) {
  return MENU_BUTTON_SET.has(text.trim());
}

export function isTelegramActionButton(text: string) {
  return ACTION_BUTTON_SET.has(text.trim());
}

async function sendCommandReply(
  chatId: number | string,
  reply: { message: string; html?: boolean }
) {
  const creds = await getTelegramCredentials();
  if (!creds?.botToken) return;
  await sendTelegramToChat(creds.botToken, chatId, reply.message, {
    html: reply.html !== false,
    showMenu: true,
  });
}

export async function handleTelegramMenuButton(
  chatId: number | string,
  buttonText: string
) {
  const cmd = MENU_TO_COMMAND[buttonText.trim()];
  if (!cmd) return;
  const reply = await handleTelegramCommand(cmd, chatId);
  await sendCommandReply(chatId, reply);
}

export async function handleTelegramCommand(
  text: string,
  _chatId?: number | string
) {
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);
  const { command, payload } = parseTelegramCommand(text);

  if (text === "/help" || command === "/help") {
    return {
      html: true,
      message:
        `🐱 <b>วิธีใช้ CatCha Bot</b>\n\n` +
        `<b>ทำรายการ</b> (กดปุ่มด้านล่าง)\n` +
        `➕ ลงนัด · 👤 ลูกค้าใหม่ · 🧾 ส่งบิล · 💸 รายจ่าย\n\n` +
        `<b>ดูรายงาน</b>\n` +
        `📅 นัดวันนี้ · ⏳ คิวรอยืนยัน · 💰 ยอดขาย · 📒 การเงิน\n\n` +
        `<b>ลัด</b>\n` +
        `<code>ยืนยัน B123</code> ยืนยันนัด\n` +
        `<code>ยกเลิก B123</code> ยกเลิกนัด\n` +
        `<code>ชำระ INV...</code> รับเงินบิล\n\n` +
        `ค้นหา: <code>/search ชื่อ</code>`,
    };
  }

  if (command === "/today") {
    const list = await bookingsForDate(today);
    if (!list.length) return { message: "📅 วันนี้ยังไม่มีนัดในระบบ" };
    return {
      message:
        `📅 นัดวันนี้ (${today})\n\n` +
        list
          .map(
            (b, i) =>
              `${i + 1}. ${b.catName} · ${b.customerName}\n` +
              `   ${b.service === "room" ? "ห้องพัก" : "อาบน้ำ"} ${b.time || ""} · ${b.status === "confirmed" ? "✅" : "⏳"}`
          )
          .join("\n\n"),
    };
  }

  if (command === "/month") {
    const list = await bookingsForMonth(ym);
    const byDay = new Map<string, number>();
    for (const b of list) {
      const d = b.date || b.checkin || "";
      if (d) byDay.set(d, (byDay.get(d) || 0) + 1);
    }
    const lines = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, n]) => `${d}: ${n} นัด`)
      .join("\n");
    return {
      message: `🗓️ ตาราง ${ym}\nรวม ${list.length} นัด\n\n${lines || "ยังไม่มีนัด"}`,
    };
  }

  if (command === "/queue") {
    const pending = (await listBookings()).filter((b) => b.status === "pending");
    if (!pending.length) return { message: "⏳ ไม่มีคิวรอยืนยัน" };
    return {
      message:
        `⏳ คิวรอยืนยัน (${pending.length})\n\n` +
        pending
          .map(
            (b, i) =>
              `${i + 1}. ${b.id} · ${b.catName} · ${b.customerName}\n   ${b.date || b.checkin} ${b.time || ""}\n   พิมพ์: ยืนยัน ${b.id}`
          )
          .join("\n\n"),
    };
  }

  if (command === "/sales") {
    const s = await salesSummary(today, today);
    const stats = await adminDashboardStats();
    return {
      message:
        `💰 ยอดขายวันนี้ (${today})\n` +
        `รับชำระ: ${s.total.toLocaleString()} บาท (${s.count} บิล)\n` +
        `รอชำระ: ${s.pending} บิล\n` +
        `นัดวันนี้: ${stats.todayAppointments} · รอยืนยัน: ${stats.queue}`,
    };
  }

  if (command === "/finance") {
    const f = await todayFinance();
    const m = await monthFinance(ym);
    return {
      message:
        `📒 การเงินวันนี้\n` +
        `รายรับ: ${f.income.toLocaleString()} บาท\n` +
        `รายจ่าย: ${f.expense.toLocaleString()} บาท\n` +
        `สุทธิ: ${f.net.toLocaleString()} บาท\n\n` +
        `เดือนนี้สุทธิ: ${m.net.toLocaleString()} บาท`,
    };
  }

  if (command === "/search") {
    const q = payload?.trim() || "";
    if (!q) return { message: "พิมพ์ /search ชื่อลูกค้าหรือชื่อแมว" };
    const found = await searchCustomers(q);
    if (!found.length) return { message: `ไม่พบ "${q}"` };
    return {
      message: found
        .slice(0, 8)
        .map(
          (c, i) =>
            `${i + 1}. ${c.name}${c.isMember ? " 💎" : ""}\n` +
            `   แมว: ${c.cats.map((cat) => cat.name).join(", ")}\n` +
            `   เครดิต: ${c.memberCredit} บาท`
        )
        .join("\n\n"),
    };
  }

  if (command === "/customers") {
    const all = (await listCustomers()).slice(0, 10);
    return {
      message: all
        .map((c, i) => `${i + 1}. ${c.name} · ${c.cats[0]?.name || "-"}`)
        .join("\n"),
    };
  }

  return {
    html: true,
    message: "กดปุ่มเมนูด้านล่าง หรือพิมพ์ <code>/help</code> ดูวิธีใช้",
  };
}
