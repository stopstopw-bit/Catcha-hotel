"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/business";

/**
 * ภาษาที่ลูกค้าเลือก — จำไว้ทั้ง localStorage และ cookie (ใช้ร่วมกันทั้งเว็บร้านและแอปในโดเมนเดียวกัน)
 * ลำดับ: ?lang= ในลิงก์ > ที่เครื่องนี้เคยเลือก > ภาษาที่ร้านจำไว้ของลูกค้า (adoptServerLocale)
 * เลือกครั้งเดียว ทุกหน้าต่อจากนั้นเป็นภาษานั้นทั้งหมด
 */
export const LOCALE_KEY = "catcha-locale";

function isLocale(v: unknown): v is Locale {
  return v === "th" || v === "en";
}

export function readStoredLocale(): Locale | null {
  try {
    const url = new URLSearchParams(window.location.search).get("lang");
    if (isLocale(url)) return url;
  } catch {
    /* ignore */
  }
  try {
    const ls = localStorage.getItem(LOCALE_KEY);
    if (isLocale(ls)) return ls;
  } catch {
    /* storage ใช้ไม่ได้ */
  }
  const m = typeof document !== "undefined" ? document.cookie.match(/(?:^|;\s*)catcha-locale=(th|en)/) : null;
  return m ? (m[1] as Locale) : null;
}

export function storeLocale(l: Locale) {
  try {
    localStorage.setItem(LOCALE_KEY, l);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${LOCALE_KEY}=${l}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* ignore */
  }
}

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** ภาษาที่ร้านจำไว้ของลูกค้า — ใช้เมื่อเครื่องนี้ยังไม่ได้เลือกภาษาเองในรอบนี้ */
  adoptServerLocale: (l: Locale) => void;
}>({ locale: "th", setLocale: () => {}, adoptServerLocale: () => {} });

export function LocaleProvider({
  children,
  initial = "th",
}: {
  children: React.ReactNode;
  initial?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  // ลูกค้ากดเลือกเองในรอบนี้แล้ว (หรือมี ?lang= ในลิงก์) — ค่าจากร้านทับไม่ได้
  const chosen = useRef(false);

  useEffect(() => {
    const saved = readStoredLocale();
    if (saved) {
      setLocaleState(saved);
      storeLocale(saved);
    }
    try {
      if (isLocale(new URLSearchParams(window.location.search).get("lang"))) chosen.current = true;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = locale;
    } catch {
      /* ignore */
    }
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    chosen.current = true;
    setLocaleState(l);
    storeLocale(l);
  }, []);

  const adoptServerLocale = useCallback((l: Locale) => {
    if (chosen.current || !isLocale(l)) return;
    setLocaleState(l);
    storeLocale(l);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, adoptServerLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

/** ตัวช่วยสองภาษา: L("ไทย", "English") — ลูกค้าภาษาอังกฤษเห็นข้อความอังกฤษ */
export function useL() {
  const { locale } = useContext(LocaleContext);
  const en = locale === "en";
  const L = useCallback((th: string, eng: string) => (en ? eng : th), [en]);
  return { L, en, locale };
}

/** ข้อความตามภาษาที่เลือกไว้ตอนนี้ — ใช้ใน useEffect/callback ที่เรียก hook ไม่ได้ (ข้อความ error ฯลฯ) */
export function trNow(th: string, eng: string): string {
  if (typeof window === "undefined") return th;
  return readStoredLocale() === "en" ? eng : th;
}
