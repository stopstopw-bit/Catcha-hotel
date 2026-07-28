"use client";

import Link from "next/link";
import { LangSwitch } from "@/components/LangSwitch";

export function PageHeader({
  title,
  subtitle,
  back,
  backLabel,
}: {
  title: string;
  subtitle?: string;
  /** ลิงก์ปุ่มย้อนกลับ — ใส่แล้วจะมีปุ่มใหญ่ๆ ให้กดกลับหน้าก่อนหน้า */
  back?: string;
  backLabel?: string;
}) {
  return (
    <div className="mb-5">
      {back && (
        <Link
          href={back}
          className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-sm font-extrabold text-catcha-chocolate shadow-catcha-sm transition active:scale-[0.97]"
        >
          <span className="text-base leading-none">←</span>
          {backLabel || "ย้อนกลับ"}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-catcha-chocolate">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-xs text-brown-soft">{subtitle}</p>
          ) : null}
        </div>
        <LangSwitch />
      </div>
    </div>
  );
}

/**
 * ป้ายบอกว่ารับเฉพาะจองล่วงหน้า ไม่รับ walk-in — ต้องเห็นก่อนดูราคา
 * ลูกค้าจะได้ไม่ขับรถมาถึงร้านแล้วต้องกลับ
 */
export function BookingOnlyNotice({ locale }: { locale: "th" | "en" }) {
  return (
    <div className="mb-4 rounded-catcha border-2 border-honey-deep/60 bg-gradient-to-r from-honey/35 to-honey/15 px-4 py-3 shadow-catcha-sm">
      <p className="text-sm font-extrabold text-catcha-chocolate">
        {locale === "th"
          ? "📌 รับเฉพาะลูกค้าที่จองล่วงหน้าเท่านั้น"
          : "📌 By appointment only"}
      </p>
      <p className="mt-1 text-xs font-bold leading-relaxed text-brown">
        {locale === "th"
          ? "ทางร้านไม่รับ Walk-in ค่ะ 🙏 รบกวนทัก LINE จองคิวก่อนเข้ามาใช้บริการทุกครั้ง เพื่อให้เราเตรียมห้องและดูแลน้องได้เต็มที่"
          : "We do not accept walk-ins. Please book via LINE before visiting so we can prepare a room and care for your cat properly."}
      </p>
    </div>
  );
}

export function LineBookingCta({ locale }: { locale: "th" | "en" }) {
  return (
    <a
      href="https://line.me/R/ti/p/@catchahotel"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-5 block rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-3.5 text-center text-sm font-extrabold text-catcha-chocolate shadow-catcha-sm"
    >
      {locale === "th"
        ? "💬 ทัก LINE @catchahotel เพื่อจอง"
        : "💬 Chat LINE @catchahotel to book"}
    </a>
  );
}
