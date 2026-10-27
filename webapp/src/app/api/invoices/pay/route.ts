import { NextRequest, NextResponse } from "next/server";
import { getInvoice } from "@/lib/invoices-store";
import { getPaymentConfig } from "@/lib/payment-config";
import { verifyPayToken } from "@/lib/doc-share";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { requireCustomerSession } from "@/lib/customer-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET ?id=&t= — บิลสำหรับหน้าชำระเงินของลูกค้า (/app/pay/[id])
 *
 * เมื่อก่อนหน้านี้ดึง /api/invoices ซึ่งเปิดเฉพาะหลังบ้าน ลูกค้าที่กดจากการ์ดเลยค้างที่
 * "กำลังโหลดข้อมูลบิล..." (ร้านเปิดจากเครื่องที่ล็อกอินอยู่เลยเห็นปกติ ไม่รู้ตัว)
 * เปิดได้เมื่อ: ลิงก์มีโทเคนที่เซ็นไว้ · หรือเป็นลูกค้าเจ้าของบิล (การ์ดเก่าที่ยังไม่มีโทเคน) · หรือหลังบ้าน
 * คืนเฉพาะช่องที่หน้าจ่ายเงินใช้
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const token = req.nextUrl.searchParams.get("t") || "";
  const inv = id ? await getInvoice(id) : null;
  if (!inv || inv.deletedAt) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let allowed = verifyPayToken(inv.id, token);
  if (!allowed) {
    const customer = await requireCustomerSession(req);
    allowed = !!customer && !!inv.lineUserId && customer.lineUserId === inv.lineUserId;
  }
  if (!allowed) allowed = !!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));
  if (!allowed) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const payment = await getPaymentConfig();
  return NextResponse.json(
    {
      invoice: {
        id: inv.id,
        customerName: inv.customerName,
        catName: inv.catName,
        items: (inv.items || []).map((it) => ({
          label: it.label,
          amount: it.amount,
          kind: it.kind,
          qty: it.qty,
          unitAmount: it.unitAmount,
          discountPercent: it.discountPercent,
          discountName: it.discountName,
        })),
        subtotal: inv.subtotal,
        discount: inv.discount,
        promoLabel: inv.promoLabel,
        total: inv.total,
        deposit: inv.deposit,
        depositReceivedAt: inv.depositReceivedAt,
        status: inv.status,
      },
      payment: {
        bankName: payment.bankName,
        accountNumber: payment.accountNumber,
        accountName: payment.accountName,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
