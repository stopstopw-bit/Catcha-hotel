import { getTelegramCredentials } from "@/lib/telegram-config";
import {
  TELEGRAM_ACTION_BUTTONS,
  sendTelegramToChat,
} from "@/lib/telegram";
import {
  clearTelegramSession,
  getTelegramSession,
  setTelegramSession,
  startFlow,
  type TelegramSession,
} from "@/lib/telegram-sessions";
import {
  findCustomerForBill,
  parseGroomTime,
  telegramAddCustomer,
  telegramAddExpense,
  telegramCancelBooking,
  telegramConfirmBooking,
  telegramCreateBill,
  telegramCreateGroomBooking,
  telegramListPendingBills,
  telegramMarkPaid,
} from "@/lib/telegram-admin";
import {
  handleTelegramCommand,
  handleTelegramMenuButton,
  isTelegramActionButton,
  isTelegramMenuButton,
} from "@/lib/telegram-commands";
import { GROOM_SLOTS } from "@/lib/business";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseQuickAction(text: string): { action: string; id: string } | null {
  const t = text.trim();
  const confirm = t.match(/^ยืนยัน\s+(B\d+)$/i);
  if (confirm) return { action: "confirm", id: confirm[1].toUpperCase() };
  const cancel = t.match(/^ยกเลิก\s+(B\d+)$/i);
  if (cancel) return { action: "cancel", id: cancel[1].toUpperCase() };
  const paid = t.match(/^ชำระ\s+(.+)$/i);
  if (paid) return { action: "paid", id: paid[1].trim() };
  return null;
}

async function reply(chatId: number | string, text: string, html = false) {
  const creds = await getTelegramCredentials();
  if (!creds?.botToken) return;
  await sendTelegramToChat(creds.botToken, chatId, text, {
    html,
    showMenu: true,
  });
}

async function handleQuickAction(chatId: number | string, action: string, id: string) {
  if (action === "confirm") {
    const r = await telegramConfirmBooking(id);
    await reply(chatId, r.ok ? r.message : `❌ ${r.message}`);
    return;
  }
  if (action === "cancel") {
    const r = await telegramCancelBooking(id);
    await reply(chatId, r.ok ? r.message : `❌ ${r.message}`);
    return;
  }
  if (action === "paid") {
    const r = await telegramMarkPaid(id);
    await reply(chatId, r.ok ? r.message : `❌ ${r.message}`);
    return;
  }
}

async function startWizard(chatId: number | string, flow: TelegramSession["flow"]) {
  if (flow === "book") {
    startFlow(chatId, "book");
    await reply(
      chatId,
      `📅 ลงนัดอาบน้ำ\n\nพิมพ์วันที่ (YYYY-MM-DD)\nเช่น 2026-07-10\n\nช่วงเวลา: ${GROOM_SLOTS.join(", ")}\n\nพิมพ์ ยกเลิก เพื่อออก`
    );
    return;
  }
  if (flow === "customer") {
    startFlow(chatId, "customer");
    await reply(chatId, "👤 เพิ่มลูกค้า\n\nพิมพ์ชื่อลูกค้า\n\nพิมพ์ ยกเลิก เพื่อออก");
    return;
  }
  if (flow === "expense") {
    startFlow(chatId, "expense");
    await reply(
      chatId,
      "💸 บันทึกรายจ่าย\n\nพิมพ์จำนวนเงิน (บาท)\nเช่น 350\n\nพิมพ์ ยกเลิก เพื่อออก"
    );
    return;
  }
  if (flow === "bill") {
    startFlow(chatId, "bill");
    await reply(
      chatId,
      "🧾 ส่งบิล/ใบเสนอราคา\n\nพิมพ์ชื่อลูกค้าหรือชื่อแมวเพื่อค้นหา\n\nพิมพ์ ยกเลิก เพื่อออก"
    );
    return;
  }
}

async function handleSessionStep(
  chatId: number | string,
  text: string,
  session: TelegramSession
) {
  if (text === "ยกเลิก" || text.toLowerCase() === "cancel") {
    clearTelegramSession(chatId);
    await reply(chatId, "ยกเลิกแล้ว — กลับเมนูหลักได้เลย");
    return;
  }

  if (session.flow === "book") {
    if (session.step === 0) {
      if (!DATE_RE.test(text)) {
        await reply(chatId, "รูปแบบวันที่ไม่ถูก — ใช้ YYYY-MM-DD เช่น 2026-07-10");
        return;
      }
      setTelegramSession(chatId, {
        ...session,
        step: 1,
        data: { ...session.data, date: text },
      });
      await reply(
        chatId,
        `พิมพ์เวลา\n${GROOM_SLOTS.map((s, i) => `${i + 1}. ${s}`).join("\n")}\nหรือพิมพ์ HH:MM`
      );
      return;
    }
    if (session.step === 1) {
      const parsed =
        parseGroomTime(text) ||
        (text.match(/^\d{1,2}:\d{2}$/) ? text : null);
      if (!parsed) {
        await reply(chatId, `เวลาไม่ถูกต้อง — เลือก ${GROOM_SLOTS.join(" / ")} หรือ HH:MM`);
        return;
      }
      const [h, m] = parsed.split(":").map(Number);
      const normalized = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      setTelegramSession(chatId, {
        ...session,
        step: 2,
        data: { ...session.data, time: normalized },
      });
      await reply(chatId, "พิมพ์ชื่อแมว");
      return;
    }
    if (session.step === 2) {
      setTelegramSession(chatId, {
        ...session,
        step: 3,
        data: { ...session.data, catName: text },
      });
      await reply(chatId, "พิมพ์ชื่อลูกค้า");
      return;
    }
    if (session.step === 3) {
      setTelegramSession(chatId, {
        ...session,
        step: 4,
        data: { ...session.data, customerName: text },
      });
      await reply(chatId, "พิมพ์เบอร์โทร (หรือ - ข้าม)");
      return;
    }
    if (session.step === 4) {
      const phone = text === "-" ? undefined : text;
      const { date, time, catName, customerName } = session.data;
      clearTelegramSession(chatId);
      await reply(chatId, "⏳ กำลังลงนัด...");
      const r = await telegramCreateGroomBooking({
        date: date!,
        time: time!,
        catName: catName!,
        customerName: customerName!,
        phone,
      });
      await reply(chatId, r.ok ? r.message : `❌ ${r.message}`);
      return;
    }
  }

  if (session.flow === "customer") {
    if (session.step === 0) {
      setTelegramSession(chatId, {
        ...session,
        step: 1,
        data: { ...session.data, customerName: text },
      });
      await reply(chatId, "พิมพ์ชื่อแมว");
      return;
    }
    if (session.step === 1) {
      setTelegramSession(chatId, {
        ...session,
        step: 2,
        data: { ...session.data, catName: text },
      });
      await reply(chatId, "พิมพ์เบอร์โทร (หรือ - ข้าม)");
      return;
    }
    if (session.step === 2) {
      const phone = text === "-" ? undefined : text;
      clearTelegramSession(chatId);
      const r = await telegramAddCustomer({
        customerName: session.data.customerName!,
        catName: session.data.catName!,
        phone,
      });
      await reply(chatId, r.ok ? r.message : `❌ ${r.message}`);
      return;
    }
  }

  if (session.flow === "expense") {
    if (session.step === 0) {
      const amount = Number(text.replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount <= 0) {
        await reply(chatId, "จำนวนเงินไม่ถูกต้อง — พิมพ์ตัวเลข เช่น 350");
        return;
      }
      setTelegramSession(chatId, {
        ...session,
        step: 1,
        data: { ...session.data, amount: String(amount) },
      });
      await reply(chatId, "พิมพ์รายละเอียดรายจ่าย (หรือ - ใช้ รายจ่ายทั่วไป)");
      return;
    }
    if (session.step === 1) {
      const description = text === "-" ? "รายจ่ายทั่วไป" : text;
      clearTelegramSession(chatId);
      const r = await telegramAddExpense(
        Number(session.data.amount),
        description
      );
      await reply(chatId, r.ok ? r.message : `❌ ${r.message}`);
      return;
    }
  }

  if (session.flow === "bill") {
    if (session.step === 0) {
      const found = await findCustomerForBill(text);
      if (!found.length) {
        await reply(chatId, `ไม่พบลูกค้า "${text}" — ลองชื่ออื่นหรือพิมพ์ ยกเลิก`);
        return;
      }
      if (found.length === 1) {
        const c = found[0];
        setTelegramSession(chatId, {
          flow: "bill",
          step: 2,
          data: {
            customerId: c.id,
            customerName: c.name,
            catName: c.cats[0]?.name || "-",
            lineUserId: c.lineUserId || "",
          },
        });
        await reply(
          chatId,
          `เลือก: ${c.name} · ${c.cats[0]?.name || "-"}\n\nพิมพ์ยอดเงิน (บาท)`
        );
        return;
      }
      const options = found
        .map(
          (c, i) =>
            `${i + 1}. ${c.name} · ${c.cats.map((cat) => cat.name).join(", ")}`
        )
        .join("\n");
      setTelegramSession(chatId, {
        ...session,
        step: 1,
        data: {
          ...session.data,
          options: JSON.stringify(
            found.map((c) => ({
              id: c.id,
              name: c.name,
              catName: c.cats[0]?.name || "-",
              lineUserId: c.lineUserId || "",
            }))
          ),
        },
      });
      await reply(chatId, `พบหลายรายการ — พิมพ์เลขที่เลือก:\n\n${options}`);
      return;
    }
    if (session.step === 1) {
      const n = Number(text);
      const options = JSON.parse(session.data.options || "[]") as Array<{
        id: string;
        name: string;
        catName: string;
        lineUserId: string;
      }>;
      const pick = options[n - 1];
      if (!pick) {
        await reply(chatId, "เลือกไม่ถูก — พิมพ์เลข 1, 2, ...");
        return;
      }
      setTelegramSession(chatId, {
        flow: "bill",
        step: 2,
        data: {
          customerId: pick.id,
          customerName: pick.name,
          catName: pick.catName,
          lineUserId: pick.lineUserId,
        },
      });
      await reply(chatId, `เลือก: ${pick.name}\n\nพิมพ์ยอดเงิน (บาท)`);
      return;
    }
    if (session.step === 2) {
      const amount = Number(text.replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount <= 0) {
        await reply(chatId, "ยอดเงินไม่ถูกต้อง");
        return;
      }
      setTelegramSession(chatId, {
        ...session,
        step: 3,
        data: { ...session.data, amount: String(amount) },
      });
      await reply(chatId, "รายละเอียดบิล (หรือ - ใช้ ค่าบริการ)");
      return;
    }
    if (session.step === 3) {
      const label = text === "-" ? "ค่าบริการ" : text;
      clearTelegramSession(chatId);
      await reply(chatId, "⏳ กำลังสร้างบิล...");
      const r = await telegramCreateBill({
        customerId: session.data.customerId!,
        customerName: session.data.customerName!,
        catName: session.data.catName!,
        lineUserId: session.data.lineUserId || undefined,
        amount: Number(session.data.amount),
        label,
        sendLine: true,
      });
      await reply(chatId, r.ok ? r.message : `❌ ${r.message}`);
      return;
    }
  }
}

const ACTION_TO_FLOW: Record<string, TelegramSession["flow"]> = {
  [TELEGRAM_ACTION_BUTTONS.book]: "book",
  [TELEGRAM_ACTION_BUTTONS.customer]: "customer",
  [TELEGRAM_ACTION_BUTTONS.expense]: "expense",
  [TELEGRAM_ACTION_BUTTONS.bill]: "bill",
};

export async function handleTelegramMessage(
  chatId: number | string,
  rawText: string
) {
  const trimmed = rawText.trim();
  if (!trimmed) return;

  const session = getTelegramSession(chatId);
  if (session) {
    await handleSessionStep(chatId, trimmed, session);
    return;
  }

  const quick = parseQuickAction(trimmed);
  if (quick) {
    await handleQuickAction(chatId, quick.action, quick.id);
    return;
  }

  if (trimmed === TELEGRAM_ACTION_BUTTONS.pendingBills) {
    const r = await telegramListPendingBills();
    await reply(chatId, r.message);
    return;
  }

  const wizardFlow = ACTION_TO_FLOW[trimmed];
  if (wizardFlow) {
    await startWizard(chatId, wizardFlow);
    return;
  }

  if (isTelegramMenuButton(trimmed)) {
    await handleTelegramMenuButton(chatId, trimmed);
    return;
  }

  if (trimmed.startsWith("/")) {
    const replyMsg = await handleTelegramCommand(trimmed, chatId);
    await reply(chatId, replyMsg.message, replyMsg.html !== false);
    return;
  }

  if (isTelegramActionButton(trimmed)) {
    return;
  }

  await reply(
    chatId,
    "ไม่เข้าใจคำสั่ง — กดปุ่มเมนูหรือพิมพ์ /help\n\nลัด:\nยืนยัน B123\nยกเลิก B123\nชำระ INV..."
  );
}
