/**
 * โดเมนหลักของเว็บ — จุดเดียวในโค้ดที่รู้จักโดเมน
 *
 * ทุกที่ต้องอ่านผ่าน getAppUrl() เท่านั้น ห้ามฝัง "https://..." เอง
 * เวลา clone ระบบไปร้านอื่น: ตั้ง NEXT_PUBLIC_APP_URL ใน env ก็จบ
 * (DEFAULT_SITE_URL มีไว้กันเว็บพังตอนยังไม่ตั้ง env — health check จะเตือนให้ตั้ง)
 */
export const DEFAULT_SITE_URL = "https://catchahotel.com";

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    DEFAULT_SITE_URL
  );
}

/** ตั้ง NEXT_PUBLIC_APP_URL แล้วหรือยัง — ใช้ใน health check */
export function isAppUrlConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_APP_URL?.trim());
}
