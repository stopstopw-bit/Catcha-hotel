/**
 * คำนวณแพ็กวันเข้าพักตามจำนวนคืนที่ลูกค้าเลือก — ไฟล์นี้ไม่มีโค้ดฝั่งเซิร์ฟเวอร์
 * ใช้ได้ทั้งในแอปลูกค้า (โชว์ราคา) และ API (คิดราคาจริง)
 */

/** ซื้อวันเข้าพักได้มากสุดกี่คืนต่อครั้ง — กันพิมพ์เลขผิดเป็นหลักพัน */
export const MAX_NIGHTS_PER_ORDER = 365;

/**
 * แพ็กวันเข้าพัก (kind="nights") — ลูกค้าเลือกจำนวนคืนเองได้
 * จำนวนคืนที่ร้านตั้งไว้ในแพ็ก = ขั้นต่ำ, ราคาต่อคืนเท่ากับราคาแพ็ก ÷ จำนวนคืนของแพ็ก
 * คำนวณที่เซิร์ฟเวอร์เสมอ ไม่เชื่อราคาที่ส่งมาจากแอป
 * แพ็กแบบอื่นคืนค่าเดิมของแพ็ก
 */
export function nightsOrderTerms(
  offer: { kind: string; totalUses: number; price: number; name: string },
  requested?: number
): { totalUses: number; price: number; name: string } {
  const min = Math.max(1, Math.floor(offer.totalUses) || 1);
  if (offer.kind !== "nights" || requested == null || !Number.isFinite(requested)) {
    return { totalUses: offer.totalUses, price: offer.price, name: offer.name };
  }
  const nights = Math.min(MAX_NIGHTS_PER_ORDER, Math.max(min, Math.floor(requested)));
  if (nights === offer.totalUses) {
    return { totalUses: offer.totalUses, price: offer.price, name: offer.name };
  }
  const price = Math.round((offer.price / min) * nights);
  return { totalUses: nights, price, name: `${offer.name} (${nights} คืน)` };
}

