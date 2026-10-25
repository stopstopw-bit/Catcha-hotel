"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type Health = {
  appUrl: string;
  db: {
    supabaseUrl: boolean;
    serviceKey: boolean;
    databaseUrl: boolean;
    connected: boolean;
    tablesReady: boolean;
    missingTables: string[];
    dbError?: string;
    allFailed?: boolean;
    message?: string;
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

const ICONS: Record<Level, string> = { ok: "check", warn: "clock", fail: "alert" };
const ICON_TONE: Record<Level, string> = {
  ok: "bg-ok/15 text-ok",
  warn: "bg-honey/30 text-catcha-chocolate",
  fail: "bg-red-100 text-red-700",
};

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
      label: "ฐานข้อมูลยังไม่เชื่อมต่อ — ข้อมูลยังอยู่ แค่แอปชี้ไม่ถูกที่",
      hint: h.db.message || "เช็ก NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY ใน Vercel แล้ว Redeploy",
    });
  } else if (h.db.allFailed) {
    // อ่านไม่ได้ทุกตาราง = ฐานข้อมูลไม่ตอบทั้งก้อน ไม่ใช่ตารางหาย — ข้อมูลยังอยู่ อย่าไปกดสร้างตารางใหม่
    rows.push({
      level: "fail",
      label: "ฐานข้อมูลตอบไม่ได้เลย — ข้อมูลยังอยู่ แค่อ่านไม่ได้",
      hint:
        `Supabase ตอบว่า: ${h.db.dbError || "ไม่ทราบสาเหตุ"} · สาเหตุที่พบบ่อย: 1) โปรเจกต์ Supabase ถูก pause → กด Restore ใน Supabase ` +
        `2) SUPABASE_SERVICE_ROLE_KEY ใน Vercel ผิด/ถูกหมุน → วางคีย์ service_role ใหม่แล้ว Redeploy ` +
        `3) NEXT_PUBLIC_SUPABASE_URL ชี้คนละโปรเจกต์ · อย่ากด "สร้างตารางอัตโนมัติ" จนกว่าจะแก้ข้อนี้`,
    });
  } else {
    rows.push({
      level: "fail",
      label: `ตารางฐานข้อมูลไม่ครบ (ขาด ${h.db.missingTables.length}: ${h.db.missingTables.join(", ")})`,
      hint: h.db.dbError
        ? `Supabase ตอบว่า: ${h.db.dbError} — ถ้าเป็นตารางหายจริง กด “สร้างตารางอัตโนมัติ” ด้านล่าง`
        : "กด “สร้างตารางอัตโนมัติ” ด้านล่าง",
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
    } else if (h.line.webhook.matchesAppUrl) {
      // URL ถูกแล้ว แต่สวิตช์ "Use webhook" ใน LINE ยังปิด — LINE ไม่มี API ให้เปิดสวิตช์นี้ กดปุ่มซ้ำไม่ช่วย
      rows.push({
        level: "fail",
        label: "LINE Webhook ปิดอยู่ (URL ถูกแล้ว)",
        hint: "เปิดสวิตช์ “Use webhook” ใน LINE Developers → แชนแนลของร้าน → แท็บ Messaging API (หรือ LINE OA Manager → ตั้งค่า → การตอบกลับ → Webhook) แล้วกดตรวจใหม่",
      });
    } else {
      rows.push({
        level: "fail",
        label: "LINE Webhook ชี้ไปเว็บอื่น",
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
        <p className="flex items-center gap-2 text-xs text-brown-soft">
          <Icon name="clock" size={16} />
          กำลังตรวจสุขภาพร้าน…
        </p>
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
      className={`mb-4 space-y-3 rounded-catcha border p-4 shadow-catcha-sm ${
        failCount ? "border-red-200 bg-red-50/50" : "border-sage/40 bg-sage/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            failCount ? "bg-red-100 text-red-700" : "bg-ok/15 text-ok"
          }`}
        >
          <Icon name={failCount ? "alert" : "check"} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Health check</p>
          <h2 className="text-sm font-extrabold text-catcha-chocolate">ตรวจสุขภาพร้าน</h2>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
            failCount ? "bg-red-100 text-red-700" : "bg-ok/15 text-ok"
          }`}
        >
          {failCount ? `ต้องแก้ ${failCount} จุด` : `พร้อม ${okCount}/${rows.length}`}
        </span>
        <button
          type="button"
          onClick={load}
          aria-label="ตรวจอีกครั้ง"
          title="ตรวจอีกครั้ง"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-brown shadow-catcha-sm"
        >
          <Icon name="clock" size={18} />
        </button>
      </div>

      <ul className="divide-y divide-catcha-line overflow-hidden rounded-catcha-sm border border-catcha-line bg-card">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-3 px-3 py-2.5">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ICON_TONE[r.level]}`}
            >
              <Icon name={ICONS[r.level]} size={13} strokeWidth={2.4} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block text-xs ${
                  r.level === "fail" ? "font-bold text-red-700" : r.level === "ok" ? "text-brown" : "font-bold text-brown"
                }`}
              >
                {r.label}
              </span>
              {r.hint && <span className="mt-0.5 block text-[11px] leading-relaxed text-brown-soft">{r.hint}</span>}
              {r.href && (
                <a
                  href={r.href}
                  className="mt-1 inline-flex min-h-[32px] items-center gap-1 text-[11px] font-bold text-latte-deep"
                >
                  เปิดหน้า
                  <Icon name="chevron" size={13} />
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
