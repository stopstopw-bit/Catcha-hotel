import { buildReceiptFlex } from "./line";
import { getCustomer } from "./customers-store";
import { getPackage, receiptCourseSummary } from "./packages-store";
import { invoiceCatNames, type InvoiceRecord } from "./invoices-store";
import type { SiteConfig } from "./config-types";

/**
 * การ์ดใบเสร็จของบิลที่ปิดแล้ว — ใช้ร่วมกันทั้งตอน "รับชำระเงิน" (ส่งอัตโนมัติ),
 * ปุ่มส่งใบเสร็จจากหน้าบิล และชุดการ์ดจากหน้านัด จะได้หน้าตา/ข้อมูลเหมือนกันทุกทาง
 */
export async function buildInvoiceReceiptFlex(inv: InvoiceRecord, cfg: SiteConfig) {
  const paidByCredit = inv.paymentMethod === "member_credit";
  // ยอดเครดิตปัจจุบันของลูกค้า = ยอดหลังหักบิลนี้ไปแล้ว (บิลถูก mark paid ไปก่อนหน้า)
  const creditCustomer = paidByCredit && inv.customerId ? await getCustomer(inv.customerId) : null;
  // คอร์สที่บิลนี้หักไป — โชว์สิทธิ์คงเหลือในใบเสร็จ ลูกค้าจะได้ไม่ต้องถาม
  const usedPkg = inv.packageId ? await getPackage(inv.packageId) : undefined;
  // ลูกค้ามีคอร์สอยู่ → สรุปคอร์สที่เหลือทุกใบไปท้ายใบเสร็จด้วย
  const courses = await receiptCourseSummary(inv.customerId, inv.packageId, inv.packageUnits);
  return buildReceiptFlex(
    {
      invoiceId: inv.id,
      customerName: inv.customerName,
      catName: invoiceCatNames(inv),
      total: inv.total,
      discount: inv.discount,
      promoLabel: inv.promoLabel,
      pointsEarned: inv.pointsEarned || 0,
      shopName: cfg.business.name,
      items: (inv.items || []).map((it) => ({ label: it.label, amount: it.amount })),
      memberCreditUsed: paidByCredit ? inv.total : undefined,
      memberCreditLeft: creditCustomer?.memberCredit,
      packageName: usedPkg?.name,
      packageUsed: usedPkg ? inv.packageUnits || 1 : undefined,
      packageLeft: usedPkg ? usedPkg.totalUses - usedPkg.usedUses : undefined,
      packageUnitLabel: usedPkg?.unit === "night" ? "คืน" : "ครั้ง",
      courses,
      paymentMethod:
        inv.paymentMethod === "member_credit"
          ? "Member Credit"
          : inv.paymentMethod === "cash"
            ? "เงินสด"
            : inv.paymentMethod === "package"
              ? "หักจากคอร์ส"
              : "โอนเงิน",
    },
    cfg.cards?.receipt
  );
}
