"use client";

import { useEffect, useState } from "react";
import { FlexPreviewStack } from "@/components/FlexPreview";
import { Icon } from "@/components/Icon";
import { runWithCardLang, type CardLangChoice } from "@/lib/card-lang-client";

/** พรีวิวการ์ดก่อนส่งจริง — ใช้ร่วมกันทั้งปุ่มส่งเดี่ยวและส่งชุดการ์ด */
export function PreviewSendModal({
  messages,
  skipped,
  recipients,
  sending,
  onConfirm,
  onCancel,
}: {
  messages: Record<string, unknown>[];
  skipped?: string[];
  /** ส่งแบบกลุ่ม — ชื่อผู้รับที่เลือกไว้ แสดงใต้การ์ด */
  recipients?: string[];
  sending: boolean;
  /** ไม่ใส่ = ดูอย่างเดียว (โหมดลองเล่น) มีแค่ปุ่มปิด */
  onConfirm?: () => void;
  onCancel: () => void;
}) {
  // ภาษาการ์ด: ตามที่ลูกค้าตั้งไว้ (ค่าเริ่มต้น) / บังคับไทย / บังคับอังกฤษ
  const [lang, setLang] = useState<CardLangChoice>("auto");
  const [enMessages, setEnMessages] = useState<Record<string, unknown>[] | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateFailed, setTranslateFailed] = useState(false);
  /** แปลได้บางข้อความ — ที่เหลือยังเป็นไทย */
  const [partial, setPartial] = useState(false);

  // เลือก EN → ขอฉบับแปลมาโชว์ให้เห็นก่อนส่ง
  useEffect(() => {
    setEnMessages(null);
    setTranslateFailed(false);
    setPartial(false);
  }, [messages]);
  useEffect(() => {
    if (lang !== "en" || enMessages || translating) return;
    setTranslating(true);
    fetch("/api/line/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.messages)) {
          setEnMessages(d.messages);
          setPartial(typeof d.translated === "number" && d.translated < d.total);
        } else setTranslateFailed(true);
      })
      .catch(() => setTranslateFailed(true))
      .finally(() => setTranslating(false));
  }, [lang, messages, enMessages, translating]);

  const shown = lang === "en" && enMessages ? enMessages : messages;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-3"
      onClick={onCancel}
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-t-[28px] bg-paper px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-catcha sm:rounded-catcha sm:pb-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-catcha-line sm:hidden" />
        <div className="mb-3 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Preview</p>
          <p className="flex items-center justify-center gap-1.5 text-sm font-extrabold text-catcha-chocolate">
            <Icon name="eye" size={16} />
            ตัวอย่างที่ลูกค้าจะเห็นใน LINE
          </p>
        </div>

        {onConfirm && (
          <div className="mb-3">
            <p className="mb-1 text-center text-[11px] font-bold text-brown-soft">ภาษาการ์ด</p>
            <div className="flex gap-1 rounded-full bg-card p-1 shadow-catcha-sm" role="radiogroup" aria-label="ภาษาการ์ด">
              {(
                [
                  ["auto", "ตามภาษาลูกค้า"],
                  ["th", "ไทย"],
                  ["en", "English"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={lang === v}
                  onClick={() => setLang(v)}
                  disabled={sending}
                  className={`min-h-[36px] flex-1 rounded-full text-xs font-bold transition ${
                    lang === v ? "bg-latte-deep text-card" : "text-brown-soft"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-center text-[10px] text-brown-faint">
              {lang === "auto"
                ? "ลูกค้าที่ตั้งภาษาอังกฤษไว้จะได้การ์ดภาษาอังกฤษ คนอื่นได้ภาษาไทย"
                : lang === "en"
                  ? translating
                    ? "กำลังแปลเป็นภาษาอังกฤษ… (ราว 5–20 วินาที)"
                    : translateFailed
                      ? "⚠️ แปลไม่สำเร็จตอนนี้ — ถ้าส่ง ระบบจะลองแปลอีกครั้ง แปลไม่ได้จะส่งภาษาไทย"
                      : partial
                        ? "แปลได้เกือบหมด บางบรรทัดยังเป็นไทย (ตัวเลขไม่ตรงจึงคงไทยไว้)"
                        : "ส่งการ์ดภาษาอังกฤษ (ตามตัวอย่างนี้)"
                  : "ส่งการ์ดภาษาไทย ทุกคน"}
            </p>
          </div>
        )}

        <FlexPreviewStack messages={shown} />

        {recipients && (
          <div className="mt-3 rounded-catcha-sm bg-card px-3 py-2 text-[11px] shadow-catcha-sm">
            <p className="flex items-center gap-1.5 font-extrabold text-catcha-chocolate">
              <Icon name="users" size={14} />
              ส่งหา {recipients.length} คน
            </p>
            <p className="mt-0.5 line-clamp-3 text-brown-soft">{recipients.join(", ")}</p>
          </div>
        )}

        {skipped && skipped.length > 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-catcha-sm bg-wait/10 px-3 py-2 text-[11px] font-bold text-wait">
            <Icon name="alert" size={16} />
            ข้ามให้: {skipped.join(", ")}
          </p>
        )}

        <div className="sticky bottom-0 -mx-4 mt-4 flex gap-2 bg-paper px-4 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={sending}
            className="min-h-[44px] flex-1 rounded-catcha-sm bg-card py-3 text-sm font-bold text-brown shadow-catcha-sm disabled:opacity-50"
          >
            {onConfirm ? "ยกเลิก" : "ปิด"}
          </button>
          {onConfirm && (
          <button
            type="button"
            onClick={() => runWithCardLang(lang, onConfirm)}
            disabled={sending || (lang === "en" && translating)}
            className="flex min-h-[44px] flex-[1.4] items-center justify-center gap-2 rounded-catcha-sm bg-[#06C755] py-3 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {!sending && <Icon name="send" size={16} />}
            {sending ? "กำลังส่ง…" : recipients ? `ยืนยันส่ง ${recipients.length} คน` : "ยืนยันส่งจริง"}
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
