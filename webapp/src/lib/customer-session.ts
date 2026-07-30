import type { NextRequest } from "next/server";
import { getOwnerCode } from "./auth";

/**
 * เซสชันลูกค้าฝั่ง LIFF — คุกกี้เซ็นชื่อ (HMAC) ที่ผูกกับ lineUserId ซึ่ง "ตรวจกับ LINE แล้วจริง"
 * (ผ่าน verifyLiffIdToken) ไม่ใช่ lineUserId ที่ client พิมพ์ส่งมาเองใน body/query
 *
 * ── ช่วงเปลี่ยนผ่าน ──
 * route ฝั่งลูกค้ายังรับ lineUserId แบบเดิมได้อยู่ (ดู resolveCustomerLineId) เพื่อไม่ให้
 * ลูกค้าที่เปิดแอปค้างไว้ก่อนอัปเดตใช้งานไม่ได้ทันที เมื่อยืนยันว่าทุกเครื่องได้คุกกี้แล้ว
 * ค่อยปิดทางเดิมโดยตั้ง env CUSTOMER_SESSION_REQUIRED=1 (ไม่ต้องแก้โค้ด)
 */

export type CustomerSessionPayload = {
  lineUserId: string;
  exp: number;
};

export const CUSTOMER_SESSION_COOKIE = "catcha_customer";
const SESSION_DAYS = 30;

function secretKey(): string {
  return process.env.SESSION_SECRET || `catcha-session::${getOwnerCode()}`;
}

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  return atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    // prefix กันชนกับคีย์ของหลังบ้าน แม้จะใช้ SESSION_SECRET ตัวเดียวกัน
    enc.encode(`customer::${secretKey()}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

export async function signCustomerSession(lineUserId: string): Promise<string> {
  const payload: CustomerSessionPayload = {
    lineUserId,
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(body)}`;
}

export async function verifyCustomerSession(
  token: string | undefined | null
): Promise<CustomerSessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let expected: string;
  try {
    expected = await hmac(body);
  } catch {
    return null;
  }
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(b64urlDecode(body)) as CustomerSessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (!payload.lineUserId) return null;
    return payload;
  } catch {
    return null;
  }
}

export function customerSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

/** บังคับให้ต้องมีคุกกี้แล้วหรือยัง — เปิดได้เมื่อมั่นใจว่าลูกค้าทุกคนได้คุกกี้ครบ */
export function customerSessionRequired(): boolean {
  return process.env.CUSTOMER_SESSION_REQUIRED === "1";
}

/**
 * หา lineUserId ที่จะใช้ทำงานใน route ฝั่งลูกค้า
 *
 * ลำดับ: คุกกี้ที่เซ็นชื่อไว้ (เชื่อถือได้) → ค่าที่ client ส่งมา (ของเดิม ระหว่างเปลี่ยนผ่าน)
 * ถ้ามีคุกกี้อยู่แล้วแต่ client ส่ง id คนอื่นมา จะยึดตามคุกกี้เสมอ — กันสวมรอย
 * ทั้งที่ตัวเองล็อกอินอยู่
 *
 * @returns lineUserId ที่ใช้ได้ หรือ null ถ้าบังคับใช้คุกกี้แล้วแต่ยังไม่มี
 */
export async function resolveCustomerLineId(
  req: NextRequest,
  claimed?: string | null
): Promise<string | null> {
  const session = await verifyCustomerSession(
    req.cookies.get(CUSTOMER_SESSION_COOKIE)?.value
  );
  if (session) return session.lineUserId;
  if (customerSessionRequired()) return null;
  const raw = String(claimed || "").trim();
  return raw || null;
}
