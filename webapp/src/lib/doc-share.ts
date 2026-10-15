import { createHmac, timingSafeEqual } from "crypto";
import { getOwnerCode } from "./auth";
import type { DocKind } from "./invoice-docs-store";

/**
 * ลิงก์เอกสารที่ส่งให้ลูกค้าทาง LINE — ลูกค้าเปิดได้โดยไม่ต้องล็อกอิน
 * แต่ต้องมีโทเคนที่เซ็นด้วย secret ของร้าน (เดา id บิลอื่นแล้วเปิดไม่ได้)
 */

function secret() {
  return `doc-share::${process.env.SESSION_SECRET || `catcha-session::${getOwnerCode()}`}`;
}

export function signDocToken(invoiceId: string, kind: DocKind): string {
  return createHmac("sha256", secret()).update(`${invoiceId}:${kind}`).digest("base64url").slice(0, 32);
}

export function verifyDocToken(invoiceId: string, kind: string, token: string): boolean {
  if (!invoiceId || !token || !["quote", "invoice", "receipt"].includes(kind)) return false;
  const want = Buffer.from(signDocToken(invoiceId, kind as DocKind));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function docShareUrl(origin: string, invoiceId: string, kind: DocKind) {
  return `${origin}/doc/${encodeURIComponent(invoiceId)}?k=${kind}&t=${signDocToken(invoiceId, kind)}`;
}
