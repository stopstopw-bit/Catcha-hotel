"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "./LocaleProvider";
import { t } from "@/lib/i18n";

const tabs = [
  { href: "/app", key: "home" as const, icon: "🏠", match: (p: string) => p === "/app" },
  {
    href: "/app/services",
    key: "services" as const,
    icon: "✨",
    match: (p: string) =>
      p.startsWith("/app/services") || p.startsWith("/app/rooms") || p.startsWith("/app/grooming"),
  },
  { href: "/app/bookings", key: "bookings" as const, icon: "📅", match: (p: string) => p.startsWith("/app/bookings") },
  { href: "/app/promos", key: "promos" as const, icon: "🎉", match: (p: string) => p.startsWith("/app/promos") },
  { href: "/app/points", key: "points" as const, icon: "⭐", match: (p: string) => p.startsWith("/app/points") },
];

export function CustomerNav() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const m = t(locale).nav;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-lg justify-between gap-1 rounded-catcha border border-catcha-line bg-card/95 px-2 py-2 shadow-catcha backdrop-blur-md">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-catcha-sm px-1 py-1.5 text-[10px] font-extrabold transition ${
                active
                  ? "bg-honey/35 text-catcha-chocolate"
                  : "text-brown-soft"
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="truncate leading-tight">{m[tab.key]}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
