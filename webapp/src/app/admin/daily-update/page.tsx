"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { Avatar, EmptyState } from "@/components/ui";
import { useConfig } from "@/components/ConfigProvider";
import { DailyUpdateSheet } from "@/components/DailyUpdateSheet";
import { PreviewSendModal } from "@/components/PreviewSendModal";
import { bangkokToday } from "@/lib/bangkok-date";
import { formatThaiDateShort } from "@/lib/format-thai-date";

type Row = {
  id: string;
  customerName: string;
  catName: string;
  service: string;
  status: string;
  date?: string;
  checkin?: string;
  checkout?: string;
  room?: string;
  roomType?: string;
  lineUserId?: string;
};

type Stay = {
  key: string;
  ids: string[];
  customerName: string;
  cats: string[];
  checkin: string;
  checkout: string;
  room: string;
  lineUserId?: string;
};

const SENT_KEY = "catcha-daily-sent";

/** จำว่าวันนี้ส่งบ้านไหนไปแล้ว (เก็บในเครื่อง — กันส่งซ้ำ/ลืมส่ง) */
function loadSent(today: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
    return new Set(raw.date === today && Array.isArray(raw.keys) ? raw.keys : []);
  } catch {
    return new Set();
  }
}
function saveSent(today: string, keys: Set<string>) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify({ date: today, keys: [...keys] }));
  } catch {
    /* ไม่มีที่เก็บก็แค่ไม่จำ */
  }
}

const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * อัปเดตน้อง — รวมน้องที่พักอยู่วันนี้ทุกบ้านไว้หน้าเดียว แตะบ้านไหนก็ติ๊ก → AI เขียน → ก๊อป / ส่งการ์ด
 */
export default function DailyUpdatePage() {
  const { config } = useConfig();
  const today = bangkokToday();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<Stay | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<{ body: Record<string, unknown>; messages: Record<string, unknown>[] } | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setSent(loadSent(today));
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d.bookings) ? d.bookings : []))
      .catch(() => setRows([]));
  }, [today]);

  // น้องที่พักอยู่วันนี้ (เช็คอินแล้ว ยังไม่ถึงวันออก) — บ้านเดียวกันเข้าพร้อมกัน = การ์ดเดียว
  const stays = useMemo<Stay[]>(() => {
    const map = new Map<string, Stay>();
    for (const b of rows || []) {
      if (b.service !== "room") continue;
      if (["cancelled", "no_show", "done"].includes(b.status)) continue;
      const checkin = (b.checkin || b.date || "").slice(0, 10);
      const checkout = (b.checkout || "").slice(0, 10);
      if (!checkin || checkin > today || (checkout && checkout <= today)) continue;
      const key = `${b.customerName}|${checkin}|${checkout}`;
      const roomId = b.room || b.roomType || "";
      const room = config.rooms?.find((r) => r.id === roomId)?.name || roomId;
      const s = map.get(key);
      if (s) {
        s.ids.push(b.id);
        if (!s.cats.includes(b.catName)) s.cats.push(b.catName);
        if (!s.lineUserId && b.lineUserId) s.lineUserId = b.lineUserId;
      } else {
        map.set(key, {
          key,
          ids: [b.id],
          customerName: b.customerName,
          cats: [b.catName],
          checkin,
          checkout,
          room,
          lineUserId: b.lineUserId,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.customerName.localeCompare(b.customerName, "th"));
  }, [rows, today, config.rooms]);

  const doneCount = stays.filter((s) => sent.has(s.key)).length;

  const markSent = (key: string) => {
    const next = new Set(sent);
    next.add(key);
    setSent(next);
    saveSent(today, next);
  };

  const preview = async (stay: Stay, text: string, imageUrl?: string) => {
    const body = {
      id: stay.ids[0],
      action: "send_daily_update",
      ids: stay.ids,
      lineUserId: stay.lineUserId,
      text,
      imageUrl,
    };
    setBusy(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, preview: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(d.preview)) setPending({ body, messages: d.preview });
      else toast(d.error ? `โหลดตัวอย่างไม่สำเร็จ: ${d.error}` : "โหลดตัวอย่างไม่สำเร็จ", "error");
    } finally {
      setBusy(false);
    }
  };

  const confirmSend = async () => {
    if (!pending || !open) return;
    setSending(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending.body),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("ส่งอัปเดตน้องวันนี้แล้ว 🐾", "success");
        markSent(open.key);
        setPending(null);
        setOpen(null);
      } else {
        toast(d.error ? `ส่งไม่สำเร็จ: ${d.error}` : "ส่งไม่สำเร็จ", "error");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pb-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Daily update</p>
      <h1 className="text-xl font-extrabold text-catcha-chocolate">อัปเดตน้อง</h1>
      <p className="mt-0.5 text-xs text-brown-soft">
        น้องที่พักอยู่วันนี้ · {formatThaiDateShort(today)}
        {stays.length > 0 && ` · ส่งแล้ว ${doneCount}/${stays.length} บ้าน`}
      </p>

      <div className="mt-4 overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
        {rows === null ? (
          <p className="px-4 py-8 text-center text-sm text-brown-soft">กำลังโหลด…</p>
        ) : stays.length === 0 ? (
          <EmptyState icon="bed" title="วันนี้ไม่มีน้องพักอยู่" sub="น้องที่เช็คอินแล้วจะขึ้นที่นี่ทุกวัน" />
        ) : (
          <ul className="divide-y divide-catcha-line">
            {stays.map((s) => {
              const done = sent.has(s.key);
              const day = dayDiff(s.checkin, today) + 1;
              const nights = s.checkout ? dayDiff(s.checkin, s.checkout) : 0;
              return (
                <li key={s.key}>
                  <button
                    type="button"
                    onClick={() => setOpen(s)}
                    className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left active:bg-paper"
                  >
                    <Avatar name={s.cats[0]} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-catcha-chocolate">
                        {s.cats.join(", ")}
                      </span>
                      <span className="block truncate text-[11px] font-bold text-brown-soft">
                        {s.customerName}
                        {s.room && ` · ${s.room}`} · วันที่ {day}
                        {nights > 0 && `/${nights}`}
                      </span>
                    </span>
                    {done ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#06C755]/15 px-2.5 py-1 text-[11px] font-extrabold text-[#06883c]">
                        <Icon name="check" size={13} strokeWidth={2.4} />
                        ส่งแล้ว
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-honey/30 px-2.5 py-1 text-[11px] font-extrabold text-catcha-chocolate">
                        <Icon name="sparkle" size={13} />
                        เขียน
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-3 text-[11px] text-brown-soft">
        แตะบ้านไหนก็ได้ → ติ๊กว่าวันนี้น้องทำอะไร → AI เขียนข้อความ → ก๊อป หรือส่งเป็นการ์ด LINE
      </p>

      {open && (
        <DailyUpdateSheet
          key={open.key}
          bookingId={open.ids[0]}
          ids={open.ids}
          busy={busy}
          onPreview={(text, imageUrl) => void preview(open, text, imageUrl)}
          onCopied={() => markSent(open.key)}
          onClose={() => setOpen(null)}
        />
      )}
      {pending && (
        <PreviewSendModal
          messages={pending.messages}
          sending={sending}
          onConfirm={confirmSend}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
