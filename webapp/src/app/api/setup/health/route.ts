import { NextResponse } from "next/server";
import { checkSetupStatus } from "@/lib/supabase/bootstrap";
import {
  getAppUrlFromEnv,
  getLineCredentials,
  getLineWebhookEndpoint,
} from "@/lib/line-config";
import { isGoogleConfigured } from "@/lib/google-config";
import { isTelegramConfigured } from "@/lib/telegram-config";
import { getSiteConfig } from "@/lib/config-store";
import { BUSINESS } from "@/lib/business";
import { isOwnerCodeConfigured, isSessionSecretConfigured } from "@/lib/auth";
import { isAppUrlConfigured } from "@/lib/app-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** รวมผลตรวจสุขภาพร้านทั้งระบบในคำขอเดียว — ไม่มี secret ในผลลัพธ์ */
export async function GET() {
  const appUrl = getAppUrlFromEnv();

  const [db, creds, googleOk, telegramOk, config] = await Promise.all([
    checkSetupStatus().catch(() => null),
    getLineCredentials(),
    isGoogleConfigured(),
    isTelegramConfigured(),
    getSiteConfig().catch(() => null),
  ]);

  // Webhook ต้องถาม LINE ตรง ๆ — ทำเฉพาะเมื่อมี token
  let webhook: { url: string; active: boolean; matchesAppUrl: boolean } | null =
    null;
  if (creds?.channelToken) {
    const ep = await getLineWebhookEndpoint(creds.channelToken);
    if (ep?.endpoint) {
      webhook = {
        url: ep.endpoint,
        active: Boolean(ep.active),
        matchesAppUrl: ep.endpoint === `${appUrl}/api/line/webhook`,
      };
    } else {
      webhook = { url: "", active: false, matchesAppUrl: false };
    }
  }

  const business = config?.business;
  const payment = config?.payment;
  const shop = {
    nameFilled: Boolean(business?.name?.trim()),
    nameIsDefault: business?.name?.trim() === BUSINESS.name,
    bankFilled: Boolean(
      payment?.accountName?.trim() &&
        payment?.accountNumber?.trim() &&
        !payment.accountNumber.includes("XXX")
    ),
    mapsFilled: Boolean(business?.maps?.trim()),
    reviewFilled: Boolean(business?.reviewUrl?.trim()),
  };

  // ความปลอดภัย/การตั้งค่าที่ต้องทำก่อนเปิดใช้จริง — สำคัญเวลา clone ระบบไปร้านใหม่
  const security = {
    // 🔴 ยังใช้รหัสหลังบ้านเริ่มต้นที่ทุก clone รู้ — ต้องตั้ง ADMIN_CODE เอง
    ownerCodeConfigured: isOwnerCodeConfigured(),
    // 🔴 ยังไม่ตั้ง SESSION_SECRET แยก — คุกกี้เซสชันจะเดาได้จากรหัสเจ้าของร้าน
    sessionSecretConfigured: isSessionSecretConfigured(),
    // ⚠️ ยังไม่ตั้งโดเมน — SEO/LINE webhook จะชี้ไปโดเมนเริ่มต้น
    appUrlConfigured: isAppUrlConfigured(),
  };

  return NextResponse.json({
    appUrl,
    db: db
      ? {
          supabaseUrl: db.supabaseUrl,
          serviceKey: db.serviceKey,
          databaseUrl: db.databaseUrl,
          connected: db.connected,
          tablesReady: db.tablesReady,
          missingTables: db.missingTables,
        }
      : null,
    line: {
      token: Boolean(creds?.channelToken),
      liff: Boolean(creds?.liffId),
      webhook,
    },
    google: googleOk,
    telegram: telegramOk,
    shop,
    security,
  });
}
