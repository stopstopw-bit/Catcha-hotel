"use client";

import Link from "next/link";
import { useEffect } from "react";
import type { Locale } from "@/lib/business";
import { storeLocale } from "@/components/LocaleProvider";

/** ลิงก์สลับภาษาของเว็บร้าน — กดแล้วจำภาษาไว้ แอปสมาชิก (/app) เปิดมาเป็นภาษานั้นด้วย */
export function LangLink({
  href,
  lang,
  className,
  children,
}: {
  href: string;
  lang: Locale;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} hrefLang={lang} lang={lang} className={className} onClick={() => storeLocale(lang)}>
      {children}
    </Link>
  );
}

/** วางในหน้าภาษาอังกฤษ — เข้าหน้านี้ = ลูกค้าอ่านภาษาอังกฤษ จำไว้ให้หน้าอื่น/แอปด้วย */
export function RememberLang({ lang }: { lang: Locale }) {
  useEffect(() => storeLocale(lang), [lang]);
  return null;
}
