import { bookingsForDate, listBookings } from "@/lib/bookings-store";
import { searchCustomers, listCustomers } from "@/lib/customers-store";
import { todayFinance, monthFinance } from "@/lib/finance-store";
import { salesSummary } from "@/lib/invoices-store";
import { adminDashboardStats, bookingsForMonth } from "@/lib/admin-stats";
import type { TelegramReply } from "@/lib/telegram-config";

function normalizeCommand(text: string) {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();
  const shortcuts: Record<string, string> = {
    m: "/month",
    t: "/today",
    q: "/queue",
    s: "/sales",
    f: "/finance",
    h: "/help",
    "?": "/help",
  };
  if (shortcuts[lower]) return shortcuts[lower];
  return trimmed;
}

export async function handleTelegramCommand(
  text: string,
  chatId?: number | string
): Promise<TelegramReply> {
  const command = normalizeCommand(text);
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);

  if (command === "/start") {
    const chatLine = chatId
      ? `\n\nChat ID ของคุณ: <b>${chatId}</b>\nนำไปใส่ใน Admin → ติดตั้ง → Telegram เพื่อรับแจ้งเตือนจอง`
      : "";
    return {
      html: true,
      keyboard: true,
      message:
        `🐱 สวัสดีจาก <b>CatCha Hotel Bot</b>${chatLine}\n\n` +
        `คำสั่ง:\n` +
        `/today — นัดวันนี้\n` +
        `/month — ตารางเดือนนี้\n` +
        `/queue — คิวรอยืนยัน\n` +
        `/sales — ยอดขายวันนี้\n` +
        `/search ชื่อ — ค้นหาลูกค้า\n` +
        `/finance — รายรับรายจ่ายวันนี้\n` +
        `/help — ดูคำสั่ง\n\n` +
        `ทางลัด: พิมพ์ <b>M</b> = เดือนนี้ · <b>T</b> = วันนี้`,
    };
  }

  if (command === "/help") {
    return {
      html: true,
      keyboard: true,
      message:
        `คำสั่ง CatCha Bot:\n` +
        `/today /month /queue /sales /search /finance\n` +
        `ทางลัด: M T Q S F\n` +
        `ตัวอย่าง: /search ส้ม`,
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
              `${i + 1}. ${b.catName} · ${b.customerName}\n   ${b.date || b.checkin} ${b.time || ""}`
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

  if (command.startsWith("/search ")) {
    const q = command.slice(8).trim();
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
    keyboard: true,
    message: `ไม่เข้าใจคำสั่ง "<b>${text}</b>"\nพิมพ์ /help หรือกดปุ่มด้านล่าง`,
  };
}
