import { NextRequest, NextResponse } from "next/server";
import { bangkokToday } from "@/lib/bangkok-date";
import { closeDay, dayTotals, getClosing, listClosings } from "@/lib/pos-store";

/** ยอดของวัน + การปิดยอดที่บันทึกไว้ + ประวัติปิดยอด */
export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date") || bangkokToday();
  const [totals, closing, history] = await Promise.all([dayTotals(date), getClosing(date), listClosings()]);
  return NextResponse.json({ date, totals, closing, history });
}

/** บันทึกปิดยอด {countedCash, openingCash, note, date?} */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.countedCash == null || body.countedCash === "") {
    return NextResponse.json({ error: "กรอกเงินสดที่นับได้" }, { status: 400 });
  }
  try {
    const closing = await closeDay({
      date: body.date ? String(body.date) : undefined,
      openingCash: Number(body.openingCash) || 0,
      countedCash: Number(body.countedCash) || 0,
      note: body.note ? String(body.note) : undefined,
    });
    return NextResponse.json({ ok: true, closing });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
