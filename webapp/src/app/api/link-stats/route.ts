import { NextResponse, type NextRequest } from "next/server";
import { getLinkStats } from "@/lib/link-clicks-store";

export const dynamic = "force-dynamic";

/** สรุปยอดหน้าลิงก์รวม (หลังบ้าน — middleware บังคับล็อกอินแล้ว) */
export async function GET(req: NextRequest) {
  const days = Math.min(365, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 30));
  return NextResponse.json(await getLinkStats(days));
}
