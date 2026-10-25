import { after } from "next/server";

/**
 * งานที่ลูกค้าไม่ต้องรอ (แจ้งเตือน Telegram/LINE, คำนวณระดับลูกค้า …) — ทำหลังส่งคำตอบกลับไปแล้ว
 * เดิมทุก route รอส่ง Telegram เสร็จก่อนตอบ (หลายรอบไป-กลับเซิร์ฟเวอร์ Telegram) ลูกค้าเลยรอนาน
 * Vercel ยังรันงานนี้ต่อจนจบหลังตอบ (waitUntil) — ไม่หาย แค่ไม่ขวางหน้าจอลูกค้า
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>) {
  after(() =>
    task().catch((e) => console.error(`${label} failed:`, e instanceof Error ? e.message : e))
  );
}
