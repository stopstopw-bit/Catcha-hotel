import { NextResponse } from "next/server";
import { adminDashboardBundle } from "@/lib/admin-stats";
import { listCustomersLite } from "@/lib/customers-store";
import { buildCustomerIdLookup, customerIdForBooking } from "@/lib/booking-customer-match";

export const dynamic = "force-dynamic";

export async function GET() {
  const { stats, calendarMonth, calendar, bookings } = await adminDashboardBundle();

  const customers = await listCustomersLite();
  const lookup = buildCustomerIdLookup(customers);
  const enrichedCalendar: Record<
    string,
    (typeof bookings[number] & { customerId?: string })[]
  > = {};

  for (const [date, dayBookings] of Object.entries(calendar)) {
    enrichedCalendar[date] = dayBookings.map((b) => ({
      ...b,
      customerId: customerIdForBooking(b, lookup),
    }));
  }

  return NextResponse.json({
    stats,
    calendarMonth,
    calendar: enrichedCalendar,
  });
}
