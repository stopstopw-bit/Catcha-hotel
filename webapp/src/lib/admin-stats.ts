import { listBookings } from "./bookings-store";
import { datesForBooking } from "./booking-customer-match";
import { todayFinance, monthFinance } from "./finance-store";
import { listInvoices } from "./invoices-store";

function salesSummaryFromInvoices(
  all: Awaited<ReturnType<typeof listInvoices>>,
  from?: string,
  to?: string
) {
  const paid = all.filter((i) => {
    if (i.status !== "paid" || !i.paidAt) return false;
    const d = i.paidAt.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
  return {
    total: paid.reduce((s, i) => s + i.total, 0),
    count: paid.length,
    pending: all.filter((i) => i.status === "pending").length,
  };
}

function buildCalendarMap(
  bookings: Awaited<ReturnType<typeof listBookings>>,
  yearMonth: string
) {
  const prefix = yearMonth.slice(0, 7);
  const map = new Map<string, typeof bookings>();
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    for (const key of datesForBooking(b)) {
      if (!key.startsWith(prefix)) continue;
      const list = map.get(key) || [];
      list.push(b);
      map.set(key, list);
    }
  }
  return map;
}

/** Single round-trip bundle for admin dashboard */
export async function adminDashboardBundle() {
  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);

  const [bookings, invoices, financeToday, financeMonth] = await Promise.all([
    listBookings(),
    listInvoices(),
    todayFinance(),
    monthFinance(ym),
  ]);

  const active = bookings.filter((b) => b.status !== "cancelled");
  const todayBookings = active.filter((b) => b.date === today || b.checkin === today);
  const pending = active.filter((b) => b.status === "pending");
  const confirmedToday = todayBookings.filter((b) => b.status === "confirmed");

  const stats = {
    today,
    queue: pending.length,
    todayAppointments: todayBookings.length,
    todayConfirmed: confirmedToday.length,
    salesToday: salesSummaryFromInvoices(invoices, today, today),
    salesMonth: salesSummaryFromInvoices(invoices, `${ym}-01`, `${ym}-31`),
    financeToday,
    financeMonth,
  };

  const calendar = Object.fromEntries(buildCalendarMap(bookings, ym));
  return { stats, calendarMonth: ym, calendar, bookings };
}

export async function adminDashboardStats() {
  const { stats } = await adminDashboardBundle();
  return stats;
}

export async function bookingsForMonth(yearMonth: string) {
  const prefix = yearMonth.slice(0, 7);
  const all = await listBookings();
  return all.filter((b) => {
    if (b.status === "cancelled") return false;
    return datesForBooking(b).some((d) => d.startsWith(prefix));
  });
}

export async function bookingsByDateMap(yearMonth: string) {
  const all = await listBookings();
  return buildCalendarMap(all, yearMonth);
}
