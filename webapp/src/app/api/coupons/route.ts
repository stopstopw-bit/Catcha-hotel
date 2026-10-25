import { NextRequest, NextResponse } from "next/server";
import {
  findCustomerByLine,
  getCustomer,
  referralCodeFor,
} from "@/lib/customers-store";
import {
  listCustomerCoupons,
  activeCustomerCoupons,
  issueCoupon,
} from "@/lib/coupons-store";
import { getLineCredentials, normalizeLiffId } from "@/lib/line-config";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { resolveCustomerLineId, noCustomerSessionResponse } from "@/lib/customer-session";
import { buildLiffUrl } from "@/lib/liff-urls";
import { getSiteConfig } from "@/lib/config-store";
import { isFeatureOn } from "@/lib/features";
import { sendTelegramLater, formatBookingTelegram } from "@/lib/telegram";

/** กระเป๋าคูปองของลูกค้า + รหัสชวนเพื่อน (แอปลูกค้า: คุกกี้เซสชันลูกค้า · หลังบ้าน: customerId) */
export async function GET(req: NextRequest) {
  // เดิม route นี้อยู่หลังด่านหลังบ้าน ลูกค้าใน LINE ยิงมาเลยโดน 401 ทุกครั้ง —
  // กระเป๋าคูปองว่างตลอด และไม่มีลิงก์ชวนเพื่อน (ปุ่มคัดลอกกดไม่ได้)
  // ตอนนี้ด่านปล่อย GET ผ่าน แล้วตรวจที่นี่: หลังบ้านดูใครก็ได้ ลูกค้าดูได้แค่ของตัวเอง
  const staff = !!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));
  const claimed = req.nextUrl.searchParams.get("lineUserId")?.trim();
  const customerId = staff ? req.nextUrl.searchParams.get("customerId")?.trim() : undefined;
  const lineUserId = staff ? claimed : await resolveCustomerLineId(req, claimed);
  if (!staff && !lineUserId) return noCustomerSessionResponse();
  const activeOnly = req.nextUrl.searchParams.get("active") === "1";

  const cust = customerId
    ? await getCustomer(customerId)
    : lineUserId
      ? await findCustomerByLine(lineUserId)
      : undefined;
  if (!cust) return NextResponse.json({ found: false, coupons: [] });

  const coupons = activeOnly
    ? await activeCustomerCoupons(cust.id)
    : await listCustomerCoupons(cust.id);
  // ร้านปิด "ชวนเพื่อนรับคูปอง" — ไม่ส่งลิงก์ชวนเพื่อนให้แอป
  const referralOn = isFeatureOn(await getSiteConfig(), "referral");
  const referralCode = referralOn ? referralCodeFor(cust.id) : "";
  // ใช้ LIFF ตัวเดียวกับที่แอปลูกค้าเปิดจริง (LiffProvider ใช้ NEXT_PUBLIC_LIFF_ID ก่อน) —
  // ร้านมี LIFF 2 ตัว ถ้าหยิบคนละตัว ลิงก์จะเปิดไปคนละ endpoint
  const liffId = referralOn
    ? normalizeLiffId(process.env.NEXT_PUBLIC_LIFF_ID) || (await getLineCredentials())?.liffId
    : undefined;
  const referralUrl = liffId
    ? buildLiffUrl(liffId, { path: "register", ref: referralCode })
    : "";
  return NextResponse.json({
    found: true,
    customerId: cust.id,
    referralCode,
    referralUrl,
    coupons,
  });
}

/** ออกคูปองด้วยมือจากหลังบ้าน (แจกลูกค้าพิเศษ / โปร) */
export async function POST(req: NextRequest) {
  if (!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const customerId = String(body.customerId || "").trim();
  const amount = Math.round(Number(body.amount) || 0);
  const reason = String(body.reason || "").trim() || "คูปองส่วนลดจากร้าน";
  const expiresInDays = Number(body.expiresInDays) || 60;
  if (!customerId || amount <= 0) {
    return NextResponse.json({ error: "customerId + amount required" }, { status: 400 });
  }
  const cust = await getCustomer(customerId);
  if (!cust) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const coupon = await issueCoupon({ customerId, amount, reason, expiresInDays });
  sendTelegramLater(
    formatBookingTelegram("🎁 ออกคูปองให้ลูกค้า (มือ)", {
      ลูกค้า: cust.name,
      มูลค่า: `${amount} บาท`,
      เหตุผล: reason,
    })
  );
  return NextResponse.json({ ok: true, coupon });
}
