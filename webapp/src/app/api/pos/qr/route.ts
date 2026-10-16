import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getSiteConfig } from "@/lib/config-store";
import { cleanPromptpayId, promptpayPayload } from "@/lib/promptpay";

/** QR พร้อมเพย์ตามยอด ?amount=… — ใช้เลขพร้อมเพย์จากตั้งค่า › การชำระเงิน */
export async function GET(req: NextRequest) {
  const amount = Math.max(0, Number(req.nextUrl.searchParams.get("amount")) || 0);
  const cfg = await getSiteConfig();
  const id = cleanPromptpayId(cfg.payment?.promptpayId);
  if (!id) return NextResponse.json({ error: "no_promptpay" }, { status: 404 });
  const dataUrl = await QRCode.toDataURL(promptpayPayload(id, amount), { margin: 1, width: 480 });
  const masked = id.length === 10 ? `${id.slice(0, 3)}-xxx-${id.slice(6)}` : `x-xxxx-xxxxx-${id.slice(10)}`;
  return NextResponse.json({ dataUrl, amount, account: masked, name: cfg.payment?.accountName || "" });
}
