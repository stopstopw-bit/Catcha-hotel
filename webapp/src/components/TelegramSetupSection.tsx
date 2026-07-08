"use client";

import { useCallback, useEffect, useState } from "react";

type TelegramStatus = {
  configured: boolean;
  source: string;
  ownerChatIds?: string[];
  webhookUrl?: string;
  webhook?: {
    url?: string;
    matches?: boolean;
    pending?: number;
    lastError?: string | null;
    expectedUrl?: string;
  };
};

export function TelegramSetupSection({ adminCode }: { adminCode: string }) {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [botToken, setBotToken] = useState("");
  const [ownerChatIds, setOwnerChatIds] = useState("2075576799");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/setup/telegram");
    const data = await res.json();
    setStatus(data);
    if (data.ownerChatIds?.length) {
      setOwnerChatIds(data.ownerChatIds.join(", "));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/setup/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminCode, botToken, ownerChatIds }),
    });
    const data = await res.json();
    setMsg(data.message || data.error || "");
    if (data.ok) {
      setBotToken("");
      await load();
    }
    setSaving(false);
  };

  if (loading) {
    return <p className="text-xs text-brown-soft">กำลังตรวจ Telegram…</p>;
  }

  const webhookOk = status?.webhook?.matches;

  return (
    <section className="mb-4 space-y-3 rounded-catcha border border-sky-200/80 bg-card p-4 shadow-catcha-sm">
      <h2 className="text-sm font-extrabold text-catcha-chocolate">💬 Telegram Bot</h2>
      <p className="text-xs text-brown-soft">
        วาง Bot Token แล้วกดบันทึก — ระบบจะตั้ง Webhook ให้อัตโนมัติ
      </p>

      {status?.configured ? (
        <div className="rounded-catcha-sm bg-sage/15 px-3 py-2 text-xs">
          <p className="font-bold text-ok">
            {webhookOk ? "✅ Bot พร้อมแล้ว" : "⚠️ Bot Token มีแล้ว แต่ Webhook ยังไม่ตรง"} (
            {status.source})
          </p>
          {status.webhookUrl && (
            <p className="mt-1 break-all text-brown-soft">Webhook: {status.webhookUrl}</p>
          )}
          {status.webhook?.lastError && (
            <p className="mt-1 text-wait">ล่าสุด: {status.webhook.lastError}</p>
          )}
          {status.ownerChatIds?.length ? (
            <p className="mt-1 text-brown-soft">
              แจ้งเตือนไปที่ Chat ID: {status.ownerChatIds.join(", ")}
            </p>
          ) : (
            <p className="mt-1 text-wait">ยังไม่ใส่ Chat ID — จะไม่ได้รับแจ้งเตือนจอง</p>
          )}
        </div>
      ) : null}

      {msg && (
        <p className="whitespace-pre-line rounded-catcha-sm bg-paper px-3 py-2 text-xs font-bold text-brown">
          {msg}
        </p>
      )}

      <label className="block text-xs font-bold text-brown-soft">
        1. Bot Token จาก @BotFather
        <input
          type="password"
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="123456789:ABCdefGHI..."
          className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
        />
      </label>

      <label className="block text-xs font-bold text-brown-soft">
        2. Chat ID เจ้าของ (ได้จากทัก /start ใน bot)
        <input
          value={ownerChatIds}
          onChange={(e) => setOwnerChatIds(e.target.value)}
          placeholder="2075576799"
          className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
        />
        <p className="mt-1 text-[10px] text-brown-faint">ใส่หลายคนได้ คั่นด้วย comma</p>
      </label>

      <button
        type="button"
        disabled={saving || !botToken.trim()}
        onClick={save}
        className="w-full rounded-catcha-sm bg-gradient-to-r from-sky-300 to-sky-400 py-3 text-sm font-extrabold text-catcha-chocolate disabled:opacity-40"
      >
        {saving ? "กำลังบันทึก…" : "💾 บันทึก + ตั้ง Webhook"}
      </button>

      <p className="text-[10px] leading-relaxed text-brown-faint">
        หลังบันทึก → ทัก bot ว่า <b>/start</b> หรือ <b>M</b> (ดูตารางเดือน) ควรได้รับคำตอบทันที
      </p>
    </section>
  );
}
