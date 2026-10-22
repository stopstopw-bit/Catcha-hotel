import { NextRequest, NextResponse } from "next/server";
import { verifyLiffAccessTokenDetailed, verifyLiffIdTokenDetailed } from "@/lib/liff-auth";
import {
  signCustomerSession,
  customerSessionCookieOptions,
  CUSTOMER_SESSION_COOKIE,
  verifyCustomerSession,
} from "@/lib/customer-session";

/**
 * แลก LIFF ID token เป็นคุกกี้เซสชันลูกค้า
 *
 * แอปเรียกอันนี้ครั้งเดียวตอนเปิด หลังจากนั้น route อื่นจะรู้เองว่าเป็นใคร
 * โดยไม่ต้องเชื่อ lineUserId ที่ส่งมากับ request
 *
 * ตรวจ token กับ LINE ไม่ผ่าน = ไม่ออกคุกกี้ให้ แต่ไม่ถือเป็น error ของแอป
 * (ระหว่างช่วงเปลี่ยนผ่าน route ยังทำงานด้วยวิธีเดิมได้ แอปจึงไม่พังถ้าตรงนี้ล้ม)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const idToken = String(body.idToken || "").trim();
  const accessToken = String(body.accessToken || "").trim();
  if (!idToken && !accessToken) {
    console.warn("[liff-auth] แอปไม่ได้ส่ง token มาเลย");
    return NextResponse.json({ ok: false, reason: "no_token" });
  }

  // ID token ก่อน · ไม่มี/ไม่ผ่าน (เช่น LIFF ไม่ได้ติ๊ก scope openid) ใช้ access token แทน
  let verified = idToken
    ? await verifyLiffIdTokenDetailed(idToken)
    : ({ ok: false, reason: "no_id_token" } as const);
  if (!verified.ok && accessToken) {
    const viaAccess = await verifyLiffAccessTokenDetailed(accessToken);
    verified = viaAccess.ok ? viaAccess : { ok: false, reason: `${verified.reason}+${viaAccess.reason}` };
  }
  if (!verified.ok) {
    return NextResponse.json({ ok: false, reason: verified.reason });
  }
  const identity = verified.identity;

  const res = NextResponse.json({
    ok: true,
    lineUserId: identity.lineUserId,
    displayName: identity.displayName,
  });
  res.cookies.set(
    CUSTOMER_SESSION_COOKIE,
    await signCustomerSession(identity.lineUserId),
    customerSessionCookieOptions()
  );
  return res;
}

/** เช็คว่าตอนนี้มีเซสชันอยู่ไหม (ใช้ดูตอนตรวจว่าเปิดบังคับได้หรือยัง) */
export async function GET(req: NextRequest) {
  const session = await verifyCustomerSession(
    req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value
  );
  return NextResponse.json({
    signedIn: Boolean(session),
    lineUserId: session?.lineUserId,
  });
}
