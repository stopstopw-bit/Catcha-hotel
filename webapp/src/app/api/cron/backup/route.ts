import { NextRequest, NextResponse } from "next/server";
import { exportToGoogleSheets } from "@/lib/google-sheets-export";
import { sendTelegram, formatBookingTelegram } from "@/lib/telegram";
import { verifyCronSecret } from "@/lib/cron-auth";

/**
 * Backup อัตโนมัติทุกคืน — ยกข้อมูลทั้งร้านลง Google Sheets
 * ลูกค้า+น้องแมว · รายรับรายจ่าย · การจอง · บิล · แต้มสะสม
 */
export async function GET(req: NextRequest) {
  const denied = verifyCronSecret(req);
  if (denied) return denied;

  const result = await exportToGoogleSheets();

  if (result.ok) {
    await sendTelegram(
      formatBookingTelegram("💾 Backup อัตโนมัติสำเร็จ", {
        ลูกค้า: String(result.customers),
        การจอง: String(result.bookings),
        บิล: String(result.invoices),
        รายการบัญชี: String(result.finance),
        แต้มสะสม: String(result.points),
        ลิงก์: result.spreadsheetUrl || "-",
      })
    );
  } else if (result.reason !== "google_not_configured") {
    // มีการตั้งค่าแล้วแต่ backup พลาด → เตือน
    await sendTelegram(
      formatBookingTelegram("⚠️ Backup อัตโนมัติล้มเหลว", {
        เหตุผล: result.reason || "unknown",
      })
    );
  }

  return NextResponse.json(result);
}
