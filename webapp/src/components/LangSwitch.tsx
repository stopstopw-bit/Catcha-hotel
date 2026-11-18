"use client";

import { useLocale } from "./LocaleProvider";
import { useLiff } from "./LiffProvider";
import { customerFetch } from "@/lib/customer-fetch";
import type { Locale } from "@/lib/business";
import { FlagIcon } from "./FlagIcon";

const LANG_NAME: Record<Locale, string> = { th: "ไทย", en: "English" };

/** เปลี่ยนภาษา + ลูกค้าที่สมัครแล้ว จำภาษาไว้ที่ร้าน (การ์ด LINE ต่อจากนี้ส่งภาษานี้) */
function useChooseLang() {
  const { locale, setLocale } = useLocale();
  const { profile, customer } = useLiff();
  const choose = (next: Locale) => {
    if (next === locale) return;
    setLocale(next);
    if (customer && profile?.lineUserId) {
      void customerFetch("/api/customers/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId: profile.lineUserId, language: next }),
      }).catch(() => {});
    }
  };
  return { locale, choose };
}

/** ปุ่มเล็กมุมจอ — กดสลับไทย/อังกฤษ (โชว์ธงของภาษาที่จะเปลี่ยนไป) */
export function LangSwitch() {
  const { locale, choose } = useChooseLang();
  const next: Locale = locale === "th" ? "en" : "th";
  return (
    <button
      type="button"
      onClick={() => choose(next)}
      aria-label={locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
      className="flex h-11 min-w-[44px] shrink-0 items-center justify-center gap-1 rounded-full border border-catcha-line bg-card px-3 text-xs font-bold text-brown-soft shadow-catcha-sm transition active:scale-95"
    >
      <FlagIcon lang={next} className="text-base" />
      {next === "en" ? "EN" : "ไทย"}
    </button>
  );
}

/** ปุ่มเลือกภาษาแบบใหญ่ 2 ปุ่ม (มีธง) — ใช้เป็นคำถามแรกของฟอร์มสมัคร */
export function LanguagePicker({ className = "" }: { className?: string }) {
  const { locale, choose } = useChooseLang();
  return (
    <div className={`rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm ${className}`}>
      <p className="mb-2 text-center text-xs font-bold text-brown">
        {locale === "en" ? "Which language do you prefer?" : "สะดวกใช้ภาษาไหนคะ"}
        <span className="block text-[11px] font-normal text-brown-faint">
          {locale === "en"
            ? "We'll send your LINE cards in this language"
            : "Which language do you prefer? · ร้านจะส่งการ์ด LINE เป็นภาษานี้"}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(["th", "en"] as Locale[]).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => choose(l)}
            aria-pressed={locale === l}
            className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 text-sm font-extrabold transition active:scale-95 ${
              locale === l
                ? "border-latte-deep bg-latte-deep/10 text-catcha-chocolate"
                : "border-catcha-line bg-paper text-brown-soft"
            }`}
          >
            <FlagIcon lang={l} className="text-2xl" />
            {LANG_NAME[l]}
          </button>
        ))}
      </div>
    </div>
  );
}
