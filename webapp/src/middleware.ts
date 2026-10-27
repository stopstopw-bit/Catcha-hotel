import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { rateLimit, clientKey } from "@/lib/rate-limit";

/**
 * ด่านตรวจสิทธิ์ก่อนเข้าถึงหลังบ้าน
 *
 * ก่อนหน้านี้หน้า /admin เช็ครหัสในเบราว์เซอร์อย่างเดียว ส่วน /api เปิดโล่งหมด
 * ใครก็ยิง /api/customers ดึงชื่อ-เบอร์-ที่อยู่ลูกค้าทั้งร้าน หรือ /api/finance ลบบัญชีได้
 * ตอนนี้ทุกอย่างต้องมีคุกกี้ที่เซ็นชื่อ ยกเว้นรายการสาธารณะด้านล่าง
 */

/** เปิดสาธารณะจริง ๆ — แอปลูกค้าใน LINE, webhook ของ LINE/Telegram, cron, ไฟล์ที่ LINE มาดึง */
const PUBLIC_API = [
  "/api/auth/login",
  // แอปลูกค้า (LIFF) — ลูกค้ายังไม่ได้ล็อกอินหลังบ้าน
  "/api/customers/register",
  "/api/customers/link",
  "/api/customers/self",
  // แลก ID token เป็นคุกกี้เซสชัน — ต้องเรียกได้ก่อนมีคุกกี้
  "/api/customers/session",
  "/api/customers/line",
  "/api/customers/cat-photo",
  // แนบรูปบัตรประชาชนจากหน้าข้อตกลงเข้าพัก — route ตรวจเองว่าเป็นลูกค้าคนนั้นจริง (resolveCustomerLineId)
  // ตกหล่นไปตอนเพิ่มฟีเจอร์ ลูกค้าเลยโดน 401 แนบไม่ได้ (มีแต่เจ้าของร้านที่ล็อกอินหลังบ้านค้างไว้ที่แนบได้)
  "/api/customers/id-card",
  "/api/bookings/consent",
  // ลูกค้าแนบสมุดวัคซีนจากลิงก์ที่ร้านส่งให้ — route ตรวจคุกกี้เซสชันลูกค้า + เป็นนัดของตัวเองเอง
  "/api/bookings/vaccine",
  // ลิงก์ที่ร้านส่งจากหน้าข้อมูลลูกค้า (ยังไม่มีนัด) — route ตรวจคุกกี้เซสชันลูกค้าเอง
  "/api/customers/cat-vaccine",
  "/api/customers/consent",
  "/api/bookings/groom-info",
  "/api/bookings/time",
  "/api/bookings/transport",
  "/api/coupons/claim",
  "/api/promos/claim",
  "/api/line/liff",
  // ลิงก์เอกสาร (ใบเสร็จ/ใบกำกับภาษี) ที่ส่งให้ลูกค้าทาง LINE — ตรวจโทเคนที่เซ็นไว้ใน route
  "/api/doc-public",
  // หน้าชำระเงินของลูกค้า (ปุ่มดูรายละเอียดในการ์ดแจ้งชำระเงิน) — route ตรวจโทเคน/เจ้าของบิลเอง
  "/api/invoices/pay",
  // ระบบภายนอกเรียกเข้ามา
  "/api/line/webhook",
  "/api/telegram/webhook",
  "/api/line/broadcast-image",
  "/api/calendar",
  "/api/cron",
];

/** เปิดเฉพาะตอนอ่าน (GET) — เขียนต้องเป็นหลังบ้าน */
const PUBLIC_GET = ["/api/config", "/api/articles", "/api/promos"];

/**
 * ใช้ร่วมกันทั้งลูกค้าและหลังบ้าน — ปล่อยผ่านด่านนี้ แล้วให้ตัว route
 * ตรวจเองว่าคนที่ไม่ได้ล็อกอินทำอะไรได้บ้าง (ดู requireAdmin ใน route)
 */
const SHARED_API = ["/api/bookings", "/api/packages", "/api/package-shop", "/api/points"];

/**
 * ใช้ร่วมกันเฉพาะ GET ที่ path นี้ตรงตัว (ไม่รวม path ย่อย เช่น /api/coupons/offers ที่เป็นของหลังบ้าน)
 * route ตรวจเอง: หลังบ้านดูได้ทุกคน ลูกค้าดูได้แค่ของตัวเองจากคุกกี้เซสชัน
 */
const SHARED_GET_EXACT = ["/api/coupons"];

/**
 * API ข้อมูลอ่อนไหวที่พนักงานใช้ได้เฉพาะเมื่อเจ้าของเปิดเมนูนั้นให้ (เจ้าของร้านใช้ได้หมด)
 * เดิมจำกัดเมนูแค่ซ่อนปุ่มในหน้าเว็บ พนักงานยิง API ตรงก็ดาวน์โหลดข้อมูลลูกค้าทั้งร้าน
 * ดูบัญชี หรือส่ง LINE หาลูกค้าทุกคนได้
 */
const STAFF_API_MENUS: [string, string[]][] = [
  ["/api/admin/backup", ["/admin/settings"]],
  ["/api/audit", ["/admin/settings"]],
  ["/api/export/sheets", ["/admin/customers", "/admin/finance", "/admin/tax"]],
  ["/api/finance", ["/admin/finance", "/admin/tax"]],
  ["/api/line/broadcast", ["/admin/promos"]],
  ["/api/setup", ["/admin/setup"]],
  ["/api/admin/migrate-photos", ["/admin/setup"]],
  ["/api/admin/cleanup-broadcast-images", ["/admin/setup"]],
];

function staffMayCall(pathname: string, menus: string[] | undefined): boolean {
  const rule = STAFF_API_MENUS.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  if (!rule) return true;
  return rule[1].some((m) => (menus || []).includes(m));
}

function matches(path: string, list: string[]) {
  return list.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * ระบบภายนอกยิงเข้ามาเป็นชุด — LINE ส่ง webhook ทีละหลายอีเวนต์, cron ยิงรอบเดียวจบ
 * ถ้าไปจำกัดตรงนี้ ข้อความลูกค้าจะหาย/แจ้งเตือนไม่ออก อันตรายกว่าที่ป้องกันได้
 */
const NO_LIMIT = ["/api/line/webhook", "/api/telegram/webhook", "/api/cron"];

/** เดารหัสหลังบ้านต้องยากที่สุด — ล็อกอินจึงคุมแยกและเข้มกว่าที่อื่นมาก */
const LOGIN_PATH = "/api/auth/login";

function limitFor(pathname: string, method: string) {
  if (matches(pathname, NO_LIMIT)) return null;
  // ล็อกอิน: 5 ครั้ง/นาที ต่อ IP — คนพิมพ์รหัสผิดจริงไม่ถึง แต่สคริปต์เดารหัสตันทันที
  if (pathname === LOGIN_PATH && method === "POST") return { limit: 5, windowMs: 60_000 };
  // เขียนข้อมูล (จอง/จ่าย/แก้ไข) หนักกว่าอ่าน จึงให้โควตาน้อยกว่า
  if (method !== "GET") return { limit: 60, windowMs: 60_000 };
  return { limit: 240, windowMs: 60_000 };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    const rule = limitFor(pathname, req.method);
    if (rule) {
      const scope = pathname === LOGIN_PATH ? LOGIN_PATH : req.method === "GET" ? "read" : "write";
      const hit = rateLimit(`${scope}:${clientKey(req)}`, rule.limit, rule.windowMs);
      if (!hit.ok) {
        return NextResponse.json(
          { error: "rate_limited", message: "ยิงคำขอถี่เกินไป รอสักครู่แล้วลองใหม่นะคะ" },
          { status: 429, headers: { "Retry-After": String(hit.retryAfter) } }
        );
      }
    }

    if (matches(pathname, PUBLIC_API)) return NextResponse.next();
    if (req.method === "GET" && matches(pathname, PUBLIC_GET)) {
      return NextResponse.next();
    }
    if (matches(pathname, SHARED_API)) return NextResponse.next();
    if (req.method === "GET" && SHARED_GET_EXACT.includes(pathname)) {
      return NextResponse.next();
    }

    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      return NextResponse.json(
        { error: "unauthorized", message: "ต้องเข้าสู่ระบบหลังบ้านก่อน" },
        { status: 401 }
      );
    }
    if (session.role === "staff" && !staffMayCall(pathname, session.menus)) {
      return NextResponse.json(
        { error: "forbidden", message: "บัญชีพนักงานนี้ไม่ได้รับสิทธิ์เมนูนี้ — ให้เจ้าของร้านเปิดสิทธิ์ให้" },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }

  // หน้าหลังบ้าน — ไม่มีคุกกี้ก็เด้งไปหน้าล็อกอิน
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*"],
};
