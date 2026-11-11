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

        <nav className="mt-6 space-y-3" aria-label="ลิงก์ของร้าน">
          {main.map((b) => (
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

        <div className="mt-6 flex justify-center gap-3">
          {social.map((b) => (
            <a
              key={b.key}
              href={go(b.key)}
              rel="nofollow"
              aria-label={b.label}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-catcha-chocolate text-xs font-extrabold text-white shadow-catcha-sm"
            >
              {b.icon}
            </a>
          ))}
        </div>

        <p className="mt-8 text-center text-[11px] text-brown-soft">© {BUSINESS.name}</p>
      </div>
    </main>
  );
}
