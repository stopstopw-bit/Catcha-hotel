import { getSecrets } from "./secrets-store";
import { getAppUrl } from "./app-url";

export type LineCredentials = {
  channelToken: string;
  liffId?: string;
  source: "env" | "database";
};

/**
 * รับได้ทั้งรหัส LIFF ล้วน หรือ URL เต็ม (แม้เผลอวางซ้ำ) แล้วตัดเหลือแต่รหัส
 * เช่น "https://liff.line.me/https://liff.line.me/123-abc?path=register" → "123-abc"
 */
export function normalizeLiffId(raw?: string): string {
  if (!raw) return "";
  let id = raw.trim();
  id = id.replace(/https?:\/\/liff\.line\.me\//gi, ""); // ตัด prefix ทุกอัน (กันวางซ้ำ)
  id = id.replace(/^\/+/, ""); // ตัด slash นำหน้า
  id = id.split(/[?#/]/)[0]; // ตัด query/path ที่ตามมา
  return id.trim();
}

export function parseLineChannelToken(raw: string) {
  const token = raw.trim();
  if (token.length < 20) {
    throw new Error(
      "Channel Access Token สั้นเกินไป — copy จาก LINE Developers → Messaging API"
    );
  }
  return token;
}

export async function getLineCredentials(): Promise<LineCredentials | null> {
  const secrets = await getSecrets();
  const line = secrets.line;
  const envToken = process.env.LINE_CHANNEL_TOKEN?.trim();
  const envLiff = normalizeLiffId(process.env.NEXT_PUBLIC_LIFF_ID);
  const dbLiff = normalizeLiffId(line?.liffId);

  if (line?.channelToken) {
    return {
      channelToken: line.channelToken,
      liffId: dbLiff || envLiff,
      source: "database",
    };
  }
  if (envToken) {
    return { channelToken: envToken, liffId: envLiff, source: "env" };
  }
  if (dbLiff) {
    return { channelToken: "", liffId: dbLiff, source: "database" };
  }
  if (envLiff) {
    return { channelToken: "", liffId: envLiff, source: "env" };
  }

  return null;
}

export async function isLineConfigured() {
  const creds = await getLineCredentials();
  return Boolean(creds?.channelToken);
}

export async function isLiffConfigured() {
  const creds = await getLineCredentials();
  return Boolean(creds?.liffId);
}

export async function testLineChannelToken(token: string) {
  const res = await fetch("https://api.line.me/v2/bot/info", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as {
    message?: string;
    displayName?: string;
    basicId?: string;
  };

  if (!res.ok) {
    const hint =
      data.message === "Authentication failed" || res.status === 401
        ? "Token ผิดหรือหมดอายุ — ออก Token ใหม่ใน LINE Developers"
        : data.message || `LINE API HTTP ${res.status}`;
    return { ok: false as const, message: hint };
  }

  return {
    ok: true as const,
    displayName: data.displayName,
    basicId: data.basicId,
  };
}

/** URL หลักของเว็บ — ใช้ตั้ง LINE webhook/LIFF/ลิงก์การ์ด ต้องเป็นโดเมนถาวรเท่านั้น
 * (ห้าม fallback ไป VERCEL_URL เพราะเปลี่ยนทุกครั้งที่ deploy ใหม่ จะทำให้ webhook หลุด) */
export function getAppUrlFromEnv() {
  return getAppUrl();
}

export function bookingConfirmUrl(bookingId: string, liffId?: string) {
  const lid = liffId || process.env.NEXT_PUBLIC_LIFF_ID;
  const base = getAppUrl();
  if (lid) {
    return `https://liff.line.me/${lid}?path=bookings&id=${bookingId}`;
  }
  return `${base}/app/bookings?id=${bookingId}`;
}

/** ดู Webhook URL ปัจจุบันของ LINE (Messaging API) */
export async function getLineWebhookEndpoint(token: string) {
  try {
    const res = await fetch(
      "https://api.line.me/v2/bot/channel/webhook/endpoint",
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    return (await res.json()) as { endpoint?: string; active?: boolean };
  } catch {
    return null;
  }
}

/** ตั้ง Webhook URL ของ LINE อัตโนมัติ (แทนการเข้า Developers Console) */
export async function setLineWebhookEndpoint(token: string, url: string) {
  const res = await fetch(
    "https://api.line.me/v2/bot/channel/webhook/endpoint",
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ endpoint: url }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false as const, message: text || `HTTP ${res.status}` };
  }
  return { ok: true as const };
}
