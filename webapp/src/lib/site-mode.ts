/**
 * โหมดของเว็บ — ขายเฉพาะระบบหลังบ้าน (/admin) + แอปสมาชิก (/app) หรือมีเว็บการตลาดด้วย
 *
 * เว็บการตลาด = หน้า landing SEO (/, /cat-hotel-*, /cat-bath-*) + บล็อก (/blog)
 * เป็นเนื้อหาเฉพาะร้าน ร้านที่ clone ระบบไปใช้ไม่ต้องมี — ตั้ง NEXT_PUBLIC_MARKETING_SITE=0 เพื่อปิด
 *
 * ⚠️ default = เปิด เพื่อไม่ให้ร้านที่ใช้เว็บการตลาดอยู่แล้ว (เช่น CatCha) หน้าหายตอน deploy ใหม่
 */
export function isMarketingSite(): boolean {
  const v = process.env.NEXT_PUBLIC_MARKETING_SITE?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
}
