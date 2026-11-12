/** ข้อความต่อท้าย toast หลังกดรับชำระ — บอกร้านว่าใบเสร็จ LINE ไปถึงลูกค้าหรือยัง */
export function receiptNote(d: { receiptSent?: boolean; receiptSkip?: string; notifyError?: string }) {
  if (d.receiptSent) return " · ส่งใบเสร็จทาง LINE แล้ว 🧾";
  if (d.notifyError) return " · ส่งใบเสร็จไม่สำเร็จ กดส่งเองที่ปุ่ม ส่ง LINE";
  if (d.receiptSkip) return ` · ไม่ได้ส่งใบเสร็จ (${d.receiptSkip})`;
  return "";
}
