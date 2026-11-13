"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { DAILY_GROUPS, DAILY_PERIOD_LABEL, guessDailyPeriod, missingRequired, toggleDailyPick, type DailyPeriod } from "@/lib/daily-update";
import { toJpegDataUrl } from "@/lib/image-convert";
import { copyText } from "@/lib/copy-text";

/**
 * อัปเดตน้องวันนี้ — ติ๊กว่าน้องทำอะไรไปบ้าง (+ โน้ต/รูป) → AI เขียนข้อความ → แก้ได้ → ดูตัวอย่างการ์ด → ส่ง
 * ข้อความทั้งหมดไปอยู่ในการ์ด LINE (ไม่ส่งข้อความเปล่า)
 */
export function DailyUpdateSheet({
  bookingId,
  ids,
  demo,
  busy,
  noLine,
  onPreview,
  onCopied,
  onClose,
}: {
  bookingId?: string;
  ids?: string[];
  /** โหมดลองเล่น — ใช้น้องตัวอย่าง ไม่ผูกกับการจอง ดูการ์ดได้แต่ไม่ส่งจริง */
  demo?: boolean;
  busy?: boolean;
  /** ลูกค้ายังไม่ผูก LINE — ก๊อปข้อความไปส่งเองได้ แต่ส่งการ์ดไม่ได้ */
  noLine?: boolean;
  onPreview: (text: string, imageUrl?: string) => void;
  /** ก๊อปข้อความสำเร็จ (หน้าอัปเดตน้องนับว่าบ้านนี้ส่งแล้ว) */
  onCopied?: () => void;
  onClose: () => void;
}) {
  const [picks, setPicks] = useState<string[]>([]);
  const [period, setPeriod] = useState<DailyPeriod>(() => guessDailyPeriod());
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [aiNote, setAiNote] = useState("");
  const [writing, setWriting] = useState(false);
  const [photo, setPhoto] = useState<{ preview: string; url?: string } | null>(null);

  const toggle = (id: string) => setPicks((p) => toggleDailyPick(p, id));
  const missing = missingRequired(picks);

  const write = async () => {
    if (missing.length) {
      toast(`เช็คก่อนนะคะ: ${missing.join(", ")}`, "error");
      return;
    }
    setWriting(true);
    try {
      const res = await fetch("/api/daily-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", id: bookingId, ids, demo: !!demo, picks, note, period }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.text) {
        toast(d.error || "เขียนข้อความไม่สำเร็จ", "error");
        return;
      }
      setText(d.text);
      setAiNote(
        d.ai
          ? ""
          : d.reason === "no_key"
            ? "ยังไม่ได้ใส่คีย์ AI — ใช้ข้อความสำเร็จรูปไปก่อน แก้ได้เลย"
            : `AI ไม่ตอบตอนนี้ — นี่เป็นข้อความสำเร็จรูป กด "เขียนใหม่" อีกครั้ง หรือแก้เองได้${d.error ? ` (${d.error})` : ""}`
      );
    } finally {
      setWriting(false);
    }
  };

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await toJpegDataUrl(file, 1200);
      setPhoto({ preview: dataUrl });
      const res = await fetch("/api/daily-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "photo", imageData: dataUrl }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.url) setPhoto({ preview: dataUrl, url: d.url });
      else {
        setPhoto(null);
        toast(d.error || "อัปรูปไม่สำเร็จ", "error");
      }
    } catch (e) {
      setPhoto(null);
      toast(e instanceof Error ? e.message : "อัปรูปไม่สำเร็จ", "error");
    }
  };

  const uploading = !!photo && !photo.url;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-3"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-card px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-catcha sm:rounded-catcha"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-honey/25 text-catcha-chocolate">
            <Icon name="sparkle" size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Daily update</p>
            <p className="truncate text-sm font-extrabold text-catcha-chocolate">
              {demo ? "ลองเล่น · น้องมะลิ (ตัวอย่าง)" : "วันนี้น้องทำอะไรไปบ้าง"}
            </p>
          </div>
          <button
            type="button"
            aria-label="ปิด"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-brown"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="mb-3 flex gap-1 rounded-full bg-paper p-1">
          {(["morning", "evening"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`min-h-[36px] flex-1 rounded-full text-xs font-bold ${
                period === p ? "bg-card text-catcha-chocolate shadow-catcha-sm" : "text-brown-soft"
              }`}
            >
              อัพเดท{DAILY_PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        {DAILY_GROUPS.map((g) => (
          <div key={g.id} className="mb-3">
            <p className="mb-1.5 text-[11px] font-bold text-brown-soft">
              {g.label}
              {g.mode === "one" && <span className="font-normal"> · เลือก 1</span>}
              {g.required && (
                <span className={missing.includes(g.label) ? "text-wait" : "text-[#06883c]"}>
                  {missing.includes(g.label) ? " · ต้องเช็ค" : " ✓"}
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.chips.map((c) => {
                const on = picks.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(c.id)}
                    className={`flex min-h-[36px] items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${
                      on ? (c.watch ? "bg-wait text-white" : "bg-latte-deep text-white") : "bg-paper text-brown-soft"
                    }`}
                  >
                    {on && <Icon name="check" size={13} strokeWidth={2.4} />}
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="เล่าเพิ่ม (ไม่บังคับ) เช่น ชอบของเล่นไม้ตกแมว นอนกอดตุ๊กตา"
          className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
        />

        <div className="mt-2 flex items-center gap-2">
          <label className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full bg-paper px-3.5 text-xs font-bold text-brown">
            <Icon name="image" size={16} />
            {photo ? "เปลี่ยนรูป" : "ใส่รูปน้อง"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void pickPhoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {photo && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.preview} alt="" className={`h-10 w-10 rounded-lg object-cover ${uploading ? "opacity-50" : ""}`} />
              <button
                type="button"
                aria-label="ลบรูป"
                onClick={() => setPhoto(null)}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brown text-white"
              >
                <Icon name="x" size={12} />
              </button>
            </div>
          )}
          {uploading && <span className="text-[11px] font-bold text-brown-soft">กำลังอัปรูป…</span>}
        </div>

        {text ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-bold text-brown-soft">ข้อความ (แก้ได้)</p>
              <button
                type="button"
                disabled={writing}
                onClick={write}
                className="flex items-center gap-1 text-[11px] font-bold text-latte-deep disabled:opacity-40"
              >
                <Icon name="sparkle" size={13} />
                {writing ? "กำลังเขียน…" : "เขียนใหม่"}
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              className="w-full rounded-catcha-sm border border-catcha-line bg-card px-3 py-2 text-sm leading-relaxed"
            />
            {aiNote && <p className="mt-1 text-[11px] font-bold text-wait">{aiNote}</p>}
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          {text && (
            <button
              type="button"
              onClick={async () => {
                const ok = await copyText(text);
                toast(ok ? "ก๊อปข้อความแล้ว 📋" : "ก๊อปไม่ได้ — กดค้างที่ข้อความแล้วก๊อปเองนะคะ", "info");
                if (ok) onCopied?.();
              }}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-catcha-sm bg-paper text-sm font-bold text-brown"
            >
              <Icon name="copy" size={16} />
              ก๊อป
            </button>
          )}
          <button
            type="button"
            disabled={writing || busy || uploading || (!!text && noLine)}
            onClick={() => (text ? onPreview(text, photo?.url) : void write())}
            className="flex min-h-[48px] flex-[2] items-center justify-center gap-2 rounded-catcha-sm bg-latte-deep text-sm font-extrabold text-white disabled:opacity-40"
          >
            <Icon name={text ? "send" : "sparkle"} size={16} />
            {writing ? "AI กำลังเขียน…" : !text && missing.length ? `เช็ค${missing.join(" + ")}ก่อน` : text ? (busy ? "กำลังโหลด…" : demo ? "ดูตัวอย่างการ์ด" : noLine ? "ยังไม่ผูก LINE" : "ส่งเป็นการ์ด LINE") : "ให้ AI เขียนข้อความ"}
          </button>
        </div>
      </div>
    </div>
  );
}
