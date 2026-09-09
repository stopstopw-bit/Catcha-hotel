"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";
import { useConfig } from "@/components/ConfigProvider";
import { BookingOnlyNotice, PageHeader } from "@/components/PageHeader";

export default function ServicesPage() {
  const { locale } = useLocale();
  const { config } = useConfig();
  const m = t(locale).home;

  const cards = [
    {
      href: "/app/rooms",
      icon: "🛏️",
      title: m.room,
      desc:
        locale === "th"
          ? "ห้องพักแมวทุกแบบ + ราคา"
          : "All cat room types + pricing",
    },
    {
      href: "/app/grooming",
      icon: "🛁",
      title: m.groom,
      desc:
        locale === "th"
          ? "เมนูอาบน้ำ-เป่าขน + รอบเวลา"
          : "Bath & grooming menu + time slots",
    },
    // โผล่ให้เห็นเฉพาะเมื่อร้านใส่เนื้อหาไว้แล้ว — ไม่งั้นเป็นลิงก์ไปหน้าเปล่า
    ...(config.boardingRules?.length
      ? [
          {
            href: "/app/boarding-rules",
            icon: "📜",
            title: locale === "th" ? "กฎระเบียบการฝาก" : "Boarding rules",
            desc:
              locale === "th"
                ? "อ่านก่อนฝากน้อง"
                : "Please read before boarding",
          },
        ]
      : []),
  ];

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        title={`✨ ${m.services}`}
        back="/app"
        backLabel={locale === "th" ? "หน้าหลัก" : "Home"}
      />
      <BookingOnlyNotice locale={locale} />
      <div className="grid gap-4">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex items-center gap-4 rounded-catcha border border-catcha-line bg-card p-5 shadow-catcha-sm transition active:scale-[0.98]"
          >
            <span className="text-3xl">{c.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold text-catcha-chocolate">{c.title}</p>
              <p className="mt-0.5 text-xs text-brown-soft">{c.desc}</p>
            </div>
            <span className="text-brown-faint">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
