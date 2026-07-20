"use client";

import { useCallback, useEffect, useState } from "react";

type Health = {
  appUrl: string;
  db: {
    supabaseUrl: boolean;
    serviceKey: boolean;
    databaseUrl: boolean;
    connected: boolean;
    tablesReady: boolean;
    missingTables: string[];
  } | null;
  line: {
    token: boolean;
    liff: boolean;
    webhook: { url: string; active: boolean; matchesAppUrl: boolean } | null;
  };
  google: boolean;
  telegram: boolean;
  shop: {
    nameFilled: boolean;
    nameIsDefault: boolean;
    bankFilled: boolean;
    mapsFilled: boolean;
    reviewFilled: boolean;
  };
  security?: {
    ownerCodeConfigured: boolean;
    sessionSecretConfigured: boolean;
    appUrlConfigured: boolean;
  };
};

type Level = "ok" | "warn" | "fail";

type Row = {
  level: Level;
  label: string;
  hint?: string;
  href?: string;
};

const ICONS: Record<Level, string> = { ok: "✅", warn: "⏳", fail: "❌" };

function buildRows(h: Health, origin: string): { rows: Row[]; failCount: number } {
  const rows: Row[] = [];

  // ---- ความปลอดภัย (จำเป็นก่อนเปิดร้านจริง) ----
  if (h.security) {
    if (!h.security.ownerCodeConfigured) {
      rows.push({
        level: "fail",
        label: "ยังใช้รหัสหลังบ้านเริ่มต้น (ไม่ปลอดภัย)",
        hint: "รหัสเริ่มต้นเหมือนกันทุกร้านที่ใช้ระบบนี้ — ใครรู้ก็เข้าหลังบ้านร้านนี้ได้ ตั้ง ADMIN_CODE เป็นของตัวเองใน Vercel แล้ว Redeploy",
      });
    } else {
      rows.push({ level: "ok", label: "ตั้งรหัสหลังบ้านเองแล้ว" });
    }
    if (!h.security.sessionSecretConfigured) {
      rows.push({
        level: "warn",
        label: "ยังไม่ได้ตั้ง SESSION_SECRET แยก",
        hint: "คุกกี้เซสชันจะอิงจากรหัสเจ้าของร้าน — ตั้ง SESSION_SECRET เป็นสตริงสุ่มยาวๆ ใน Vercel เพื่อความปลอดภัยเต็มที่",
      });
    }
  }

  // ---- ฐานข้อมูล (จำเป็น) ----
  if (!h.db) {
    rows.push({ level: "fail", label: "ฐานข้อมูล — ตรวจไม่ได้", hint: "เช็ก env Supabase ใน Vercel แล้วรีเฟรช" });
  } else if (h.db.connected && h.db.tablesReady) {
    rows.push({ level: "ok", label: "ฐานข้อมูล (Supabase) เชื่อมต่อ + ตารางครบ" });
  } else if (!h.db.connected) {
    rows.push({
      level: "fail",
      label: "ฐานข้อมูลยังไม่เชื่อมต่อ",
      hint: "ลูกค้าที่สมัคร/ข้อมูลที่กรอกจะไม่ถูกบันทึกจริง — เช็ก NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ใน Vercel",
    });
  } else {
    rows.push({
      level: "fail",
      label: `ตารางฐานข้อมูลไม่ครบ (ขาด ${h.db.missingTables.length})`,
      hint: "กด ⚡ สร้างตารางอัตโนมัติ ด้านล่าง",
    });
  }

  // ---- URL เว็บ (จำเป็น) ----
  if (!h.appUrl) {
    rows.push({
      level: "fail",
      label: "ยังไม่ได้ตั้ง NEXT_PUBLIC_APP_URL",
      hint: "ตั้งใน Vercel = โดเมนของร้านนี้ แล้ว Redeploy",
    });
  } else if (origin && h.appUrl !== origin) {
    rows.push({
      level: "fail",
      label: "URL ระบบไม่ตรงกับเว็บที่เปิดอยู่",
      hint: `ระบบตั้งไว้ ${h.appUrl} แต่คุณเปิดจาก ${origin} — การ์ด/LIFF/Webhook จะชี้ผิดเว็บ แก้ NEXT_PUBLIC_APP_URL ใน Vercel ให้ตรง แล้ว Redeploy`,
    });
  } else {
    rows.push({ level: "ok", label: `URL ระบบตรงกับเว็บนี้ (${h.appUrl})` });
  }

  // ---- LINE ----
  rows.push(
    h.line.token
      ? { level: "ok", label: "LINE Token — พร้อมส่งการ์ด/ใบเสร็จ" }
      : {
          level: "warn",
          label: "LINE Token ยังไม่ตั้ง",
          hint: "ส่งการ์ด/ใบเสร็จเข้า LINE ลูกค้าไม่ได้ — ตั้งที่การ์ด LINE Messaging ด้านล่าง",
        }
  );
  rows.push(
    h.line.liff
      ? { level: "ok", label: "LINE LIFF — ลูกค้าเปิดแอปจาก LINE ได้" }
      : {
          level: "warn",
          label: "LIFF ยังไม่ตั้ง",
          hint: "ลูกค้าเปิดแอป/สมัครสมาชิกจาก LINE ไม่ได้ — ตั้งที่การ์ด LINE LIFF ด้านล่าง",
        }
  );
  if (h.line.webhook) {
    if (h.line.webhook.active && h.line.webhook.matchesAppUrl) {
      rows.push({ level: "ok", label: "LINE Webhook — เชื่อมแล้ว ชี้มาที่ระบบนี้" });
    } else if (!h.line.webhook.url) {
      rows.push({
        level: "warn",
        label: "ยังไม่ได้ตั้ง LINE Webhook",
        hint: "กดปุ่ม “ตั้ง Webhook อัตโนมัติ” ในการ์ด LINE Messaging",
      });
    } else {
      rows.push({
        level: "fail",
        label: h.line.webhook.matchesAppUrl ? "LINE Webhook ปิดอยู่" : "LINE Webhook ชี้ไปเว็บอื่น",
        hint: `ตอนนี้ชี้ไป ${h.line.webhook.url || "—"} — กด “ตั้ง Webhook อัตโนมัติ” อีกครั้งเพื่อแก้`,
      });
    }
  }

  // ---- ข้อมูลร้าน ----
  if (!h.shop.nameFilled) {
    rows.push({ level: "warn", label: "ยังไม่ได้ตั้งชื่อร้าน", hint: "การ์ดที่ส่งหาลูกค้าจะไม่มีชื่อร้าน", href: "/admin/settings" });
  } else if (h.shop.nameIsDefault) {
    rows.push({
      level: "warn",
      label: "ชื่อร้านยังเป็นค่าเริ่มต้น (CatCha Hotel)",
      hint: "ถ้านี่ไม่ใช่ร้าน CatCha ให้แก้ใน ตั้งค่า ก่อนส่งการ์ดหาลูกค้า",
      href: "/admin/settings",
    });
  } else {
    rows.push({ level: "ok", label: "ตั้งชื่อร้านแล้ว" });
  }
  rows.push(
    h.shop.bankFilled
      ? { level: "ok", label: "บัญชีธนาคารครบ (ขึ้นบนการ์ดมัดจำ/ชำระเงิน)" }
      : { level: "warn", label: "บัญชีธนาคารยังไม่ครบ", hint: "ชื่อ/เลขบัญชียังว่างหรือเป็นค่าตัวอย่าง — กรอกใน ตั้งค่า", href: "/admin/settings" }
  );

  // ---- เสริม ----
  rows.push(
    h.google
      ? { level: "ok", label: "Google Calendar + Sheets เชื่อมแล้ว" }
      : { level: "warn", label: "Google ยังไม่เชื่อม (ข้ามได้)", hint: "จองไม่ขึ้นปฏิทิน / ส่งออกชีตไม่ได้ จนกว่าจะตั้ง" }
  );
  rows.push(
    h.telegram
      ? { level: "ok", label: "Telegram แจ้งเตือนเจ้าของ เชื่อมแล้ว" }
      : { level: "warn", label: "Telegram ยังไม่เชื่อม (ข้ามได้)", hint: "จะไม่มีแจ้งเตือนจองใหม่/คนแอด LINE เข้ามือถือเจ้าของ" }
  );

  return { rows, failCount: rows.filter((r) => r.level === "fail").length };
}

export function HealthCheckSection() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/setup/health");
      setHealth(await res.json());
    } catch {
      setHealth(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <section className="mb-4 rounded-catcha bg-card p-4 shadow-catcha-sm">
        <p className="text-xs text-brown-soft">🩺 กำลังตรวจสุขภาพร้าน…</p>
      </section>
    );
  }
  if (!health) {
    return (
      <section className="mb-4 rounded-catcha bg-card p-4 shadow-catcha-sm">
        <p className="text-xs font-bold text-wait">ตรวจสุขภาพร้านไม่สำเร็จ — รีเฟรชหน้านี้อีกครั้ง</p>
      </section>
    );
  }

  const { rows, failCount } = buildRows(health, origin);
  const okCount = rows.filter((r) => r.level === "ok").length;

  return (
    <section
      className={`mb-4 space-y-2 rounded-catcha border-2 p-4 shadow-catcha-sm ${
        failCount ? "border-red-300 bg-red-50/50" : "border-sage/40 bg-sage/10"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-catcha-chocolate">
          🩺 ตรวจสุขภาพร้าน
        </h2>
        <span className={`text-xs font-extrabold ${failCount ? "text-wait" : "text-ok"}`}>
          {failCount ? `⚠️ ต้องแก้ ${failCount} จุด` : `พร้อมใช้งาน (${okCount}/${rows.length})`}
        </span>
      </div>

      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="text-xs">
            <span className="mr-1.5">{ICONS[r.level]}</span>
            <span className={r.level === "fail" ? "font-bold text-wait" : r.level === "ok" ? "text-ok" : "text-brown"}>
              {r.label}
            </span>
            {r.hint && (
              <span className="mt-0.5 block pl-6 text-[10px] text-brown-soft">
                {r.hint}
                {r.href && (
                  <>
                    {" "}
                    <a href={r.href} className="font-bold text-latte-deep underline">
                      เปิดหน้า →
                    </a>
                  </>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={load}
        className="w-full rounded-catcha-sm bg-paper py-2 text-xs font-bold text-brown-soft"
      >
        🔄 ตรวจอีกครั้ง
      </button>
    </section>
  );
}
