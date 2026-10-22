import { getInvoice } from "./invoices-store";
import { getCustomer } from "./customers-store";
import { getSiteConfig } from "./config-store";
import { getBuyerProfile, getInvoiceDoc, lastBuyerForCustomer } from "./invoice-docs-store";

/** ข้อมูลครบสำหรับแสดงเอกสาร: บิล + ผู้ขาย + ผู้ซื้อ + เลขที่ (ใช้ทั้งหลังบ้านและลิงก์ลูกค้า) */
export async function buildDocPayload(invoiceId: string, opts: { forCustomer?: boolean } = {}) {
  const invoice = invoiceId ? await getInvoice(invoiceId) : undefined;
  if (!invoice || invoice.deletedAt) return undefined;
  const [doc, customer, config] = await Promise.all([
    getInvoiceDoc(invoiceId),
    invoice.customerId ? getCustomer(invoice.customerId) : Promise.resolve(undefined),
    getSiteConfig(),
  ]);
  // ลูกค้าที่บันทึกข้อมูลออกบิลไว้ (ในนามบริษัท) → ใช้กับบิลนี้อัตโนมัติ จนกว่าจะเลือกอย่างอื่นเฉพาะบิล
  const profile = doc?.buyer ? undefined : await getBuyerProfile(invoice.customerId);
  const suggestedBuyer =
    doc?.buyer || profile || opts.forCustomer ? undefined : await lastBuyerForCustomer(invoice.customerId);
  const effectiveDoc = doc ? { ...doc, buyer: doc.buyer || profile } : { invoiceId, buyer: profile };
  const b = config.business;
  return {
    // ลิงก์ลูกค้า: ส่งเฉพาะช่องที่โชว์บนเอกสาร ไม่ส่ง LINE id / ข้อมูลภายในอื่น ๆ
    invoice: opts.forCustomer
      ? {
          id: invoice.id,
          customerId: "",
          customerName: invoice.customerName,
          catName: invoice.catName,
          items: invoice.items,
          subtotal: invoice.subtotal,
          discount: invoice.discount,
          deposit: invoice.deposit,
          promoLabel: invoice.promoLabel,
          total: invoice.total,
          status: invoice.status,
          paymentMethod: invoice.paymentMethod,
          paidAt: invoice.paidAt,
          createdAt: invoice.createdAt,
        }
      : invoice,
    doc: opts.forCustomer ? { ...effectiveDoc, customerId: undefined } : effectiveDoc,
    /** ผู้ซื้อบนบิลนี้มาจากข้อมูลออกบิลที่จำไว้ของลูกค้า (ยังไม่ได้ตั้งเฉพาะบิล) */
    fromProfile: !!profile,
    suggestedBuyer,
    customer: customer
      ? { name: customer.name, phone: customer.phone || "", address: customer.address || "" }
      : { name: invoice.customerName, phone: "", address: "" },
    seller: {
      name: b.legalName || b.name,
      shopName: b.name,
      address: b.location?.th || "",
      phone: b.phones?.filter(Boolean)[0] || "",
      taxId: b.taxId || "",
      branch: b.taxBranch || "",
      vatRegistered: !!b.vatRegistered,
      vatRate: b.vatRate ?? 7,
      logo: b.docLogo || "",
    },
    payment: config.payment,
    /** ลูกค้าผูก LINE แล้วหรือยัง — ไว้เปิด/ปิดปุ่มส่งทาง LINE */
    hasLine: !opts.forCustomer && !!(invoice.lineUserId || customer?.lineUserId),
  };
}
