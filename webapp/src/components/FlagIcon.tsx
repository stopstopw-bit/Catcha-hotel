import type { Locale } from "@/lib/business";

/**
 * ธงภาษาเป็นรูป SVG — ธงอีโมจิ (🇬🇧/🇹🇭) บน Windows แสดงเป็นตัวอักษร "GB"/"TH" แทนธง
 * รูป SVG จึงเห็นเป็นธงเหมือนกันทุกเครื่อง
 */
export function FlagIcon({ lang, className = "" }: { lang: Locale; className?: string }) {
  const cls = `inline-block h-[1em] w-[1.5em] shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)] ${className}`;
  if (lang === "en") {
    return (
      <svg viewBox="0 0 60 40" className={cls} aria-hidden="true" preserveAspectRatio="none">
        <rect width="60" height="40" fill="#012169" />
        <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="8" />
        <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="3" />
        <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="12" />
        <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 9 6" className={cls} aria-hidden="true" preserveAspectRatio="none">
      <rect width="9" height="6" fill="#A51931" />
      <rect y="1" width="9" height="4" fill="#F4F5F8" />
      <rect y="2" width="9" height="2" fill="#2D2A4A" />
    </svg>
  );
}
