import { GROOM_SLOTS, ROOMS } from "@/lib/business";
import {
  addBooking,
  cancelBooking,
  getBooking,
  updateBooking,
} from "@/lib/bookings-store";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
  updateCalendarEventConfirmed,
} from "@/lib/calendar";
import {
  resolveCustomerForBooking,
  searchCustomers,
  upsertCustomerFromBooking,
  getCustomer,
  topupMemberCredit,
} from "@/lib/customers-store";
import { addFinanceEntry } from "@/lib/finance-store";
import {
  createInvoice,
  listInvoices,
  markInvoicePaid,
  markInvoiceSent,
} from "@/lib/invoices-store";
import { getPaymentConfig } from "@/lib/payment-config";
import {
  buildPaymentFlex,
  buildReceiptFlex,
  pushLineMessage,
} from "@/lib/line";
import { BUSINESS } from "@/lib/business";
import { formatBookingTelegram, sendTelegram } from "@/lib/telegram";

export async function telegramCreateGroomBooking(data: {
  customerName: string;
  catName: string;
  date: string;
  time: string;
  phone?: string;
  notes?: string;
}) {
  const customer = await resolveCustomerForBooking({
    customerName: data.customerName,
    catName: data.catName,
    phone: data.phone,
    staffNote: data.notes,
  });
  if (!customer) {
    return { ok: false as const, message: "ต้องมีชื่อลูกค้าและชื่อแมว" };
  }

  const booking = await addBooking({
    customerName: customer.name,
    catName: data.catName,
    service: "groom",
    date: data.date,
    time: data.time,
    lineUserId: customer.lineUserId,
    notes: data.notes,
  });

  const cal = await createCalendarEvent({
    summary: `🛁 ${data.catName} (${customer.name})`,
    description: `อาบน้ำ · ${data.notes || ""}`,
    start: data.date,
    end: data.date,
    time: data.time,
    allDay: false,
    service: "groom",
    eventId: booking.id,
  });

  await updateBooking(booking.id, { calendarEventId: cal.eventId });

  await sendTelegram(
    formatBookingTelegram("📌 จองใหม่ (Telegram)", {
      ลูกค้า: customer.name,
      น้องแมว: data.catName,
      บริการ: "อาบน้ำ",
      วันที่: `${data.date} ${data.time}`,
      รหัส: booking.id,
    })
  );

  return {
    ok: true as const,
    message:
      `✅ ลงนัดแล้ว\n` +
      `🆔 ${booking.id}\n` +
      `👤 ${customer.name} · 🐱 ${data.catName}\n` +
      `📅 ${data.date} ${data.time}\n` +
      (cal.googleUrl ? `📎 ${cal.googleUrl}` : ""),
    bookingId: booking.id,
  };
}

export async function telegramCreateRoomBooking(data: {
  customerName: string;
  catName: string;
  checkin: string;
  checkout: string;
  roomId: string;
  phone?: string;
  notes?: string;
}) {
  const room = ROOMS.find((r) => r.id === data.roomId);
  if (!room) {
    return { ok: false as const, message: "ไม่พบห้องที่เลือก" };
  }
  if (data.checkout <= data.checkin) {
    return { ok: false as const, message: "วันเช็คเอาต์ต้องหลังวันเช็คอิน" };
  }

  const customer = await resolveCustomerForBooking({
    customerName: data.customerName,
    catName: data.catName,
    phone: data.phone,
    staffNote: data.notes,
  });
  if (!customer) {
    return { ok: false as const, message: "ต้องมีชื่อลูกค้าและชื่อแมว" };
  }

  const booking = await addBooking({
    customerName: customer.name,
    catName: data.catName,
    service: "room",
    date: data.checkin,
    checkin: data.checkin,
    checkout: data.checkout,
    room: room.id,
    lineUserId: customer.lineUserId,
    notes: data.notes,
  });

  const cal = await createCalendarEvent({
    summary: `🏠 ${data.catName} (${customer.name})`,
    description: `ห้องพัก ${room.name} · ${data.notes || ""}`,
    start: data.checkin,
    end: data.checkout,
    allDay: true,
    service: "room",
    eventId: booking.id,
  });

  await updateBooking(booking.id, { calendarEventId: cal.eventId });

  await sendTelegram(
    formatBookingTelegram("📌 จองห้องใหม่ (Telegram)", {
      ลูกค้า: customer.name,
      น้องแมว: data.catName,
      ห้อง: room.name,
      เช็คอิน: data.checkin,
      เช็คเอาต์: data.checkout,
      รหัส: booking.id,
    })
  );

  return {
    ok: true as const,
    message:
      `✅ จองห้องแล้ว\n` +
      `🆔 ${booking.id}\n` +
      `👤 ${customer.name} · 🐱 ${data.catName}\n` +
      `🏠 ${room.name}\n` +
      `📅 ${data.checkin} → ${data.checkout}\n` +
      (cal.googleUrl ? `📎 ${cal.googleUrl}` : ""),
    bookingId: booking.id,
  };
}

export async function telegramTopupMember(data: {
  customerId: string;
  paidAmount: number;
  bonusAmount?: number;
  note?: string;
}) {
  const result = await topupMemberCredit(data.customerId, {
    paidAmount: data.paidAmount,
    bonusAmount: data.bonusAmount || 0,
    note: data.note,
  });
  if (!result) {
    return { ok: false as const, message: "เติมเครดิตไม่สำเร็จ — ตรวจสอบยอดและลูกค้า" };
  }
  const { customer, topup } = result;
  return {
    ok: true as const,
    message:
      `✅ เติม Member แล้ว\n` +
      `👤 ${customer.name}\n` +
      `💰 รับ ${topup.paidAmount.toLocaleString()} บาท` +
      (topup.bonusAmount > 0
        ? ` + แถม ${topup.bonusAmount.toLocaleString()} บาท`
        : "") +
      `\n➕ เครดิตรวม +${topup.creditAdded.toLocaleString()} บาท` +
      `\n💎 คงเหลือ ${customer.memberCredit.toLocaleString()} บาท`,
  };
}

export async function telegramAddCustomer(data: {
  customerName: string;
  catName: string;
  phone?: string;
}) {
  const c = await upsertCustomerFromBooking({
    customerName: data.customerName,
    catName: data.catName,
    phone: data.phone,
  });
  return {
    ok: true as const,
    message:
      `✅ เพิ่มลูกค้าแล้ว\n` +
      `🆔 ${c.id}\n` +
      `👤 ${c.name} · 🐱 ${data.catName}` +
      (data.phone ? `\n📞 ${data.phone}` : ""),
    customerId: c.id,
  };
}

export async function telegramAddExpense(amount: number, description: string) {
  const rec = await addFinanceEntry({
    type: "expense",
    amount,
    category: "ทั่วไป",
    description,
    date: new Date().toISOString().slice(0, 10),
  });
  return {
    ok: true as const,
    message: `✅ บันทึกรายจ่าย ${amount.toLocaleString()} บาท\n📝 ${description}\n🆔 ${rec.id}`,
  };
}

export async function telegramCreateBill(data: {
  customerId: string;
  customerName: string;
  catName: string;
  lineUserId?: string;
  amount: number;
  label: string;
  sendLine?: boolean;
}) {
  const invoice = await createInvoice({
    customerId: data.customerId,
    lineUserId: data.lineUserId,
    customerName: data.customerName,
    catName: data.catName,
    items: [{ label: data.label, amount: data.amount }],
  });

  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const payUrl = `${base}/app/pay/${invoice.id}`;
  let lineSent = false;

  if (data.sendLine !== false && data.lineUserId) {
    const payment = await getPaymentConfig();
    await pushLineMessage(data.lineUserId, [
      buildPaymentFlex({
        invoiceId: invoice.id,
        customerName: data.customerName,
        catName: data.catName,
        total: invoice.total,
        items: invoice.items,
        payUrl,
        bankName: payment.bankName,
        accountNumber: payment.accountNumber,
        accountName: payment.accountName,
      }),
    ]);
    await markInvoiceSent(invoice.id);
    lineSent = true;
  }

  return {
    ok: true as const,
    message:
      `✅ สร้างบิล ${invoice.total.toLocaleString()} บาท\n` +
      `🆔 ${invoice.id}\n` +
      `👤 ${data.customerName} · ${data.label}\n` +
      (lineSent ? `📱 ส่งลิงก์ชำระใน LINE แล้ว` : `🔗 ${payUrl}`),
    invoiceId: invoice.id,
    payUrl,
  };
}

export async function telegramConfirmBooking(id: string) {
  const b = await getBooking(id);
  if (!b) return { ok: false as const, message: `ไม่พบนัด ${id}` };
  if (b.status === "confirmed") {
    return { ok: true as const, message: `✅ นัด ${id} ยืนยันแล้วอยู่แล้ว` };
  }

  await updateBooking(id, { status: "confirmed" });
  if (b.calendarEventId) {
    await updateCalendarEventConfirmed(b.calendarEventId, {
      summary: `${b.service === "room" ? "🏠" : "🛁"} ${b.catName} (${b.customerName})`,
      description: `${b.service === "room" ? "ห้องพัก" : "อาบน้ำ"} · ${b.notes || ""}`,
      start: b.date || b.checkin || "",
      end: b.checkout || b.date || b.checkin || "",
      time: b.time,
      allDay: b.service === "room" && !b.time,
      service: b.service === "room" ? "room" : "groom",
    });
  }

  return {
    ok: true as const,
    message: `✅ ยืนยันนัด ${id}\n🐱 ${b.catName} · ${b.customerName}`,
  };
}

export async function telegramCancelBooking(id: string) {
  const b = await getBooking(id);
  if (!b) return { ok: false as const, message: `ไม่พบนัด ${id}` };

  await cancelBooking(id);
  if (b.calendarEventId) {
    const del = await deleteCalendarEvent(b.calendarEventId);
    if (!del.ok) {
      await updateCalendarEvent(
        b.calendarEventId,
        {
          summary: `${b.service === "room" ? "🏠" : "🛁"} ${b.catName} (${b.customerName})`,
          description: `${b.service === "room" ? "ห้องพัก" : "อาบน้ำ"} · ${b.notes || ""}`,
          start: b.date || b.checkin || "",
          end: b.checkout || b.date || b.checkin || "",
          time: b.time,
          allDay: b.service === "room" && !b.time,
          service: b.service === "room" ? "room" : "groom",
          eventId: b.id,
        },
        { cancelled: true }
      );
    }
  }

  return {
    ok: true as const,
    message: `❌ ยกเลิกนัด ${id}\n🐱 ${b.catName} · ${b.customerName}`,
  };
}

export async function telegramMarkPaid(invoiceId: string) {
  const result = await markInvoicePaid(invoiceId, "transfer");
  if (!result.ok) {
    return { ok: false as const, message: `ชำระไม่สำเร็จ: ${result.error}` };
  }

  const paid = result.invoice!;
  if (paid.lineUserId) {
    await pushLineMessage(paid.lineUserId, [
      buildReceiptFlex({
        invoiceId: paid.id,
        customerName: paid.customerName,
        catName: paid.catName,
        total: paid.total,
        pointsEarned: paid.pointsEarned || 0,
        paymentMethod: "โอนเงิน",
        mapsUrl: BUSINESS.maps,
      }),
    ]);
  }

  return {
    ok: true as const,
    message:
      `✅ รับเงินแล้ว ${paid.total.toLocaleString()} บาท\n` +
      `🆔 ${paid.id}\n` +
      `👤 ${paid.customerName} · 🐱 ${paid.catName}`,
  };
}

export async function telegramListPendingBills() {
  const pending = (await listInvoices()).filter((i) => i.status === "pending");
  if (!pending.length) return { message: "🧾 ไม่มีบิลรอชำระ" };
  return {
    message:
      `🧾 บิลรอชำระ (${pending.length})\n\n` +
      pending
        .slice(0, 10)
        .map(
          (i) =>
            `${i.id}\n` +
            `   ${i.customerName} · ${i.catName} · ${i.total.toLocaleString()} บาท`
        )
        .join("\n\n") +
      `\n\nรับเงินแล้วพิมพ์: ชำระ INV...`,
  };
}

export function parseGroomTime(input: string) {
  const t = input.trim();
  if (GROOM_SLOTS.includes(t as (typeof GROOM_SLOTS)[number])) return t;
  if (t === "1") return GROOM_SLOTS[0];
  if (t === "2") return GROOM_SLOTS[1];
  if (t === "3") return GROOM_SLOTS[2];
  return null;
}

export async function findCustomerForBill(query: string) {
  const found = await searchCustomers(query.trim());
  return found.slice(0, 5);
}

export function parseRoomChoice(input: string) {
  const t = input.trim();
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= ROOMS.length) {
    return ROOMS[n - 1].id;
  }
  const byId = ROOMS.find((r) => r.id === t);
  if (byId) return byId.id;
  const byName = ROOMS.find(
    (r) => r.name.toLowerCase() === t.toLowerCase()
  );
  return byName?.id || null;
}

export function formatRoomPickerList() {
  return ROOMS.map(
    (r, i) => `${i + 1}. ${r.name} (${r.price}฿/คืน)`
  ).join("\n");
}

export async function getCustomerBrief(id: string) {
  return getCustomer(id);
}
