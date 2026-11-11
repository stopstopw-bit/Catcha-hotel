"use client";

import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui";
import { LINK_PLATFORMS, buttonLabel, platformLabel } from "@/lib/link-hub";
import type { LinkStats } from "@/lib/link-clicks-store";

type Days = "7" | "30" | "90";

/** การ์ดในหน้าสรุปข้อมูล: หน้าลิงก์รวม /links — คนเปิด/คลิกจากแพลตฟอร์มไหนมากสุด + ลิงก์ไว้แปะ */
export function LinkHubStats() {
  const [days, setDays] = useState<Days>("30");
  const [stats, setStats] = useState<LinkStats | null>(null);
  const [showLinks, setShowLinks] = useState(false);
  const [copied, setCopied] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    setStats(null);
    fetch(`/api/link-stats?days=${days}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats({ days: +days, totalViews: 0, totalClicks: 0, platforms: [], buttons: [], empty: true }));
  }, [days]);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* ignore */
    }
  };

  const maxClicks = Math.max(1, ...(stats?.platforms.map((p) => p.clicks) ?? [1]));

  return (
    <section className="rounded-catcha bg-card p-4 shadow-catcha-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-catcha-chocolate">🔗 ลิงก์รวมของร้าน (โซเชียล)</h2>
          <p className="text-[11px] text-brown-soft">คนเปิดหน้า /links และกดปุ่ม แยกตามแพลตฟอร์มที่แปะลิงก์</p>
        </div>
        <a href="/links" target="_blank" rel="noopener" className="shrink-0 text-xs font-bold text-latte-deep underline">
          ดูหน้า
        </a>
      </div>

      <Segmented
        value={days}
        onChange={setDays}
        options={[
          { id: "7", label: "7 วัน" },
          { id: "30", label: "30 วัน" },
          { id: "90", label: "90 วัน" },
        ]}
      />

      {!stats ? (
        <p className="py-6 text-center text-xs text-brown-soft">กำลังโหลด…</p>
      ) : stats.empty ? (
        <p className="py-6 text-center text-xs text-brown-soft">ยังไม่มีคนเปิดลิงก์ในช่วงนี้ — แปะลิงก์ด้านล่างในแต่ละแพลตฟอร์มก่อนนะคะ</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="เปิดหน้า" value={stats.totalViews} />
            <Stat label="คลิกปุ่ม" value={stats.totalClicks} />
            <Stat
              label="คลิก LINE"
              value={stats.buttons.filter((b) => b.key === "line" || b.key === "lineoa").reduce((n, b) => n + b.clicks, 0)}
            />
          </div>

          <h3 className="mb-2 mt-4 text-xs font-extrabold text-catcha-chocolate">มาจากลิงก์ไหน → กดไปช่องทางไหน</h3>
          <div className="space-y-2.5">
            {stats.platforms.map((p) => (
              <div key={p.src} className="text-xs">
                <div className="mb-0.5 flex justify-between gap-2">
                  <span className="min-w-0 truncate font-bold text-brown">{platformLabel(p.src)}</span>
                  <span className="shrink-0 text-brown-soft">
                    เปิด {p.views} · <b className="text-latte-deep">คลิก {p.clicks}</b>
                    {p.views ? ` (${Math.round((p.clicks / p.views) * 100)}%)` : ""}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-paper">
                  <div className="h-full rounded-full bg-latte-deep/70" style={{ width: `${(p.clicks / maxClicks) * 100}%` }} />
                </div>
                {p.clicks ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(p.byButton)
                      .sort((a, b) => b[1] - a[1])
                      .map(([k, n]) => (
                        <span key={k} className="rounded-full bg-paper px-2 py-0.5 text-[10px] text-brown-soft">
                          → {buttonLabel(k)} <b className="text-latte-deep">{n}</b>
                        </span>
                      ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {stats.buttons.length ? (
            <>
              <h3 className="mb-2 mt-4 text-xs font-extrabold text-catcha-chocolate">ปุ่มที่คนกดมากสุด</h3>
              <ul className="space-y-1 text-xs">
                {stats.buttons.map((b) => (
                  <li key={b.key} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate text-brown">{buttonLabel(b.key)}</span>
                    <b className="shrink-0 text-latte-deep">{b.clicks}</b>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}

      <button
        type="button"
        onClick={() => setShowLinks((v) => !v)}
        className="mt-4 w-full rounded-full bg-paper py-2 text-xs font-bold text-catcha-chocolate"
      >
        {showLinks ? "ซ่อนลิงก์" : "ลิงก์สำหรับแปะแต่ละแพลตฟอร์ม"}
      </button>
      {showLinks ? (
        <ul className="mt-2 space-y-1.5">
          {LINK_PLATFORMS.map((p) => {
            const url = `${origin}/links/${p.id}`;
            return (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2 text-xs">
                <span className="min-w-0 flex-1">
                  <b className="block text-brown">{p.label}</b>
                  <span className="block truncate text-brown-soft">{url.replace(/^https?:\/\//, "")} · {p.hint}</span>
                </span>
                <button type="button" onClick={() => copy(url)} className="shrink-0 rounded-full bg-card px-3 py-1.5 font-bold text-latte-deep shadow-catcha-sm">
                  {copied === url ? "คัดลอกแล้ว" : "คัดลอก"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-paper px-2 py-2">
      <p className="text-lg font-extrabold text-catcha-chocolate">{value.toLocaleString()}</p>
      <p className="text-[10px] font-bold text-brown-soft">{label}</p>
    </div>
  );
}
