import { NextRequest, NextResponse } from "next/server";
import { bangkokToday } from "@/lib/bangkok-date";
import { buildTodayBrief } from "@/lib/today-brief";

export const dynamic = "force-dynamic";

/**
 * หน้าแรกหลังร้าน › ลูกค้าวันนี้ — ต้องระวัง / ต้องทำ / การดูแล ของแต่ละบ้าน
 * มีข้อมูลสุขภาพน้อง จึงอยู่ใต้ /api/admin (middleware บังคับล็อกอินหลังร้าน)
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("date") || "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : bangkokToday();
  const items = await buildTodayBrief(date);
  return NextResponse.json({ date, items });
}
