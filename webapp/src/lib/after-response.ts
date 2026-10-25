import { after } from "next/server";
import { sendTelegram } from "./telegram";

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

/**
 * แจ้งเจ้าของร้านหลังตอบลูกค้าแล้ว — ใช้ใน route ฝั่งลูกค้าแทน await sendTelegram()
 * ลูกค้าไม่ต้องรอ Telegram (ช้า/ล่มก็ไม่ขวางการสมัคร/จอง) ข้อความยังส่งครบเหมือนเดิม
 * อยู่ไฟล์นี้ ไม่ใช่ telegram.ts — telegram.ts ถูกดึงเข้าหน้า client ทางอ้อม (promos-store → customers-store)
 * ซึ่ง import after ไม่ได้
 */
export function sendTelegramLater(text: string) {
  runAfterResponse("telegram notify", () => sendTelegram(text));
}
