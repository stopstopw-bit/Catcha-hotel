"use client";

import Link from "next/link";
import { LangSwitch } from "@/components/LangSwitch";
import { Icon } from "@/components/Icon";

/** ปุ่มหลักของหน้า (มีได้หน้าละ 1 ปุ่ม) — เต็มความกว้าง สูง ≥ 48px */
export const BTN_PRIMARY =
  "flex min-h-[48px] w-full items-center justify-center gap-2 rounded-catcha-sm bg-latte-deep px-4 py-3 text-sm font-extrabold text-card shadow-catcha-sm transition active:scale-[0.98] disabled:opacity-50";

/** ปุ่มรอง — พื้นอ่อน ไม่แย่งความเด่นจากปุ่มหลัก */
export const BTN_SECONDARY =
  "flex min-h-[44px] w-full items-center justify-center gap-2 rounded-catcha-sm bg-paper px-4 py-2.5 text-sm font-bold text-catcha-chocolate transition active:scale-[0.98] disabled:opacity-50";

/** การ์ดเนื้อหามาตรฐานของแอปลูกค้า */
export const CARD = "rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm";

/**
 * หัวหน้าแบบเดียวกันทุกหน้า: (ปุ่มย้อนกลับ) · eyebrow อังกฤษตัวเล็ก · ชื่อหน้าไทย · ปุ่มสลับภาษา
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  back,
  backLabel,
  showLang = true,
}: {
  title: string;
  subtitle?: string;
  /** ป้ายภาษาอังกฤษตัวพิมพ์ใหญ่เหนือชื่อหน้า */
  eyebrow?: string;
  /** ลิงก์ปุ่มย้อนกลับ — ใส่แล้วจะมีปุ่มลูกศรวงกลมด้านซ้าย */
  back?: string;
  backLabel?: string;
  showLang?: boolean;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      {back && (
        <Link
          href={back}
          aria-label={backLabel || "ย้อนกลับ"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-catcha-chocolate shadow-catcha-sm transition active:scale-95"
        >
          <Icon name="back" size={20} strokeWidth={2.2} />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-xl font-extrabold leading-tight text-catcha-chocolate">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-xs text-brown-soft">{subtitle}</p> : null}
      </div>
      {showLang && <LangSwitch />}
    </div>
  );
}

/**
 * ป้ายบอกว่ารับเฉพาะจองล่วงหน้า ไม่รับ walk-in — ต้องเห็นก่อนดูราคา
 * ลูกค้าจะได้ไม่ขับรถมาถึงร้านแล้วต้องกลับ
 */
export function BookingOnlyNotice({ locale }: { locale: "th" | "en" }) {
  return (
    <div className="mb-4 flex gap-3 rounded-catcha border border-honey-deep/40 bg-honey/20 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-catcha-chocolate">
        <Icon name="calendar" size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-catcha-chocolate">
          {locale === "th" ? "รับเฉพาะลูกค้าที่จองล่วงหน้า" : "By appointment only"}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-brown">
          {locale === "th"
            ? "ทางร้านไม่รับ Walk-in ค่ะ รบกวนทัก LINE จองคิวก่อนเข้ามาใช้บริการทุกครั้ง เพื่อให้เราเตรียมห้องและดูแลน้องได้เต็มที่"
            : "We do not accept walk-ins. Please book via LINE before visiting so we can prepare a room and care for your cat properly."}
        </p>
      </div>
    </div>
  );
}

export function LineBookingCta({ locale }: { locale: "th" | "en" }) {
  return (
    <a
      href="https://line.me/R/ti/p/@catchahotel"
      target="_blank"
      rel="noopener noreferrer"
      className={`mt-5 ${BTN_PRIMARY}`}
    >
      <Icon name="message" size={18} />
      {locale === "th" ? "ทัก LINE @catchahotel เพื่อจอง" : "Chat LINE @catchahotel to book"}
    </a>
  );
}
