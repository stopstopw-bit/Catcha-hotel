import Image from "next/image";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BUSINESS } from "@/lib/business";
import { LINK_BUTTONS, cleanSrc, isBotUserAgent } from "@/lib/link-hub";
import { recordLinkEvent } from "@/lib/link-clicks-store";
import { isMarketingSite } from "@/lib/site-mode";

/** หน้าลิงก์รวม (ใช้ทั้ง /links และ /links/<แพลตฟอร์ม>) — นับคนเปิดหน้าแล้วโชว์ปุ่ม */
export default async function LinkHubPage({ src: rawSrc }: { src?: string }) {
  if (!isMarketingSite()) redirect("/app");
  const src = cleanSrc(rawSrc);
  const ua = (await headers()).get("user-agent");
  if (!isBotUserAgent(ua)) await recordLinkEvent("view", src);

  const go = (key: string) => `/go/${key}?src=${encodeURIComponent(src)}`;
  const main = LINK_BUTTONS.filter((b) => !b.social);
  const primary = main.find((b) => b.primary);
  const rest = main.filter((b) => !b.primary);
  const social = LINK_BUTTONS.filter((b) => b.social);

  return (
    <main className="min-h-screen bg-gradient-to-b from-honey/30 via-[#fbf6ef] to-[#fbf6ef] px-4 pb-10 pt-10">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <Image
            src="/logo.jpg"
            alt={BUSINESS.name}
            width={96}
            height={96}
            priority
            className="mx-auto h-24 w-24 rounded-full border-4 border-white object-cover shadow-catcha"
          />
          <h1 className="mt-3 text-xl font-extrabold text-catcha-chocolate">{BUSINESS.name}</h1>
          <p className="mt-1 text-sm font-bold text-brown-soft">{BUSINESS.tagline.th}</p>
          <p className="text-xs text-brown-soft">{BUSINESS.location.th} · เปิด 09:00–19:00 ทุกวัน</p>
        </div>

        {primary ? (
          <a
            href={go(primary.key)}
            rel="nofollow"
            className="mt-6 flex min-h-[60px] items-center gap-3 rounded-catcha bg-[#06c755] px-4 py-3 text-white shadow-catcha transition active:scale-[0.98]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/25 text-lg" aria-hidden>
              {primary.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold leading-tight">{primary.label}</span>
              {primary.sub ? <span className="block truncate text-xs text-white/85">{primary.sub}</span> : null}
            </span>
            <span aria-hidden className="text-white/80">›</span>
          </a>
        ) : null}

        <h2 className="mb-2 mt-6 text-center text-xs font-extrabold uppercase tracking-[0.12em] text-brown-soft">
          ติดตามเราช่องทางอื่น
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {social.map((b) => (
            <a
              key={b.key}
              href={go(b.key)}
              rel="nofollow"
              style={{ background: b.brand }}
              className="flex min-h-[96px] flex-col items-start justify-between rounded-catcha p-3.5 text-white shadow-catcha-sm transition active:scale-[0.98]"
            >
              <BrandIcon name={b.icon} />
              <span>
                <span className="block text-[15px] font-extrabold leading-tight">{b.label}</span>
                {b.sub ? <span className="block truncate text-[11px] text-white/85">{b.sub}</span> : null}
              </span>
            </a>
          ))}
        </div>

        <h2 className="mb-2 mt-6 text-center text-xs font-extrabold uppercase tracking-[0.12em] text-brown-soft">
          บริการ & ข้อมูลร้าน
        </h2>
        <nav className="space-y-3" aria-label="ลิงก์ของร้าน">
          {rest.map((b) => (
            <a
              key={b.key}
              href={go(b.key)}
              rel="nofollow"
              className={
                b.primary
                  ? "flex min-h-[60px] items-center gap-3 rounded-catcha bg-[#06c755] px-4 py-3 text-white shadow-catcha transition active:scale-[0.98]"
                  : "flex min-h-[56px] items-center gap-3 rounded-catcha bg-card px-4 py-3 text-catcha-chocolate shadow-catcha-sm transition active:scale-[0.98]"
              }
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/25 text-lg" aria-hidden>
                {b.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-extrabold leading-tight">{b.label}</span>
                {b.sub ? (
                  <span className={`block truncate text-xs ${b.primary ? "text-white/85" : "text-brown-soft"}`}>{b.sub}</span>
                ) : null}
              </span>
              <span aria-hidden className={b.primary ? "text-white/80" : "text-latte-deep"}>›</span>
            </a>
          ))}
        </nav>

        <p className="mt-8 text-center text-[11px] text-brown-soft">© {BUSINESS.name}</p>
      </div>
    </main>
  );
}

/** โลโก้ช่องทางแบบเส้นเรียบ (ไม่ใช้รูปจากภายนอก) */
function BrandIcon({ name }: { name: string }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  if (name === "ig")
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  if (name === "tiktok")
    return (
      <svg {...common} fill="currentColor">
        <path d="M14 3h3a4 4 0 0 0 4 4v3a7 7 0 0 1-4-1.3V15a6 6 0 1 1-6-6h.5v3.1A3 3 0 1 0 14 15V3z" />
      </svg>
    );
  if (name === "fb")
    return (
      <svg {...common} fill="currentColor">
        <path d="M13.5 21v-7.5H16l.5-3h-3V8.6c0-.9.3-1.6 1.6-1.6h1.6V4.3c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.2H7.5v3h2.8V21h3.2z" />
      </svg>
    );
  return (
    <svg {...common} fill="currentColor">
      <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s5.9-3.5 8-6c1.4-1.6 2-3.2 2-4.8C22 6.6 17.5 3 12 3zM8 13.5H6.1V8.8h1v3.8H8v.9zm1.8 0h-1V8.8h1v4.7zm4.6 0h-.9l-2-2.8v2.8h-1V8.8h.9l2 2.8V8.8h1v4.7zm3.4-3.8h-1.9v.9h1.9v.9h-1.9v1h1.9v.9H15V8.8h2.8v.9z" />
    </svg>
  );
}
