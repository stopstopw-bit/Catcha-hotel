import { NextRequest, NextResponse } from "next/server";
import { resolveCustomerLineId, noCustomerSessionResponse } from "@/lib/customer-session";
import { findCustomerByLine, setCustomerIdCard } from "@/lib/customers-store";
import { uploadDataUrlToStorage } from "@/lib/supabase/storage";

/**
 * ลูกค้าแนบรูปบัตรประชาชน (ผู้ปกครองน้องแมว) สำหรับลงทะเบียนเข้าพัก
 * รูปที่ส่งมามีข้อความขีดทับฝังไว้แล้วจากฝั่งเครื่องลูกค้า (lib/id-card-watermark)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const lineUserId = await resolveCustomerLineId(req, body.lineUserId);
  if (!lineUserId) return noCustomerSessionResponse();
  const image = String(body.image || "");
  if (!image.startsWith("data:image/")) {
    return NextResponse.json({ error: "image required" }, { status: 400 });
  }
  const c = await findCustomerByLine(lineUserId);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = await uploadDataUrlToStorage(`id-cards/${c.id}-${Date.now()}`, image);
  const res = await setCustomerIdCard(c.id, url);
  if (!res.ok) return NextResponse.json({ error: res.error, needSql: true }, { status: 500 });
  return NextResponse.json({ ok: true, url });
}
