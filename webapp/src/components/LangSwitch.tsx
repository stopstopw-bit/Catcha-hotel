"use client";

import { useLocale } from "./LocaleProvider";
import { t } from "@/lib/i18n";
import { useLiff } from "./LiffProvider";
import { customerFetch } from "@/lib/customer-fetch";

export function LangSwitch() {
  const { locale, setLocale } = useLocale();
  const { profile, customer } = useLiff();
  const next = locale === "th" ? "en" : "th";
  const choose = () => {
    setLocale(next);
    // ลูกค้าที่สมัครแล้ว — จำภาษาไว้ที่ร้าน การ์ด LINE ต่อจากนี้ส่งภาษานี้
    if (customer && profile?.lineUserId) {
      void customerFetch("/api/customers/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId: profile.lineUserId, language: next }),
      }).catch(() => {});
    }
  };
  return (
    <button
      type="button"
      onClick={choose}
      aria-label={locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
      className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full border border-catcha-line bg-card px-3 text-xs font-bold text-brown-soft shadow-catcha-sm transition active:scale-95"
    >
      {t(locale).common.lang}
    </button>
  );
}
