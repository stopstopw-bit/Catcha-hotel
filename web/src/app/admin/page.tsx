"use client";

import { useState } from "react";
import { DEMO_BOOKINGS, type Booking } from "@/lib/business";

export default function AdminDashboard() {
  const [view, setView] = useState<"today" | "week">("today");
  const [bookings] = useState<Booking[]>(DEMO_BOOKINGS);

  const sendCard = (id: string) => {
    alert(`ส่งการ์ด LINE ให้ ${id} (จะต่อ API จริง)`);
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(["today", "week"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-full px-4 py-2 text-xs font-bold ${
              view === v ? "bg-honey/50 text-catcha-chocolate" : "bg-paper text-brown-soft"
            }`}
          >
            {v === "today" ? "📅 วันนี้" : "🗓️ สัปดาห์นี้"}
          </button>
        ))}
      </div>

      <section className="rounded-catcha bg-card p-4 shadow-catcha-sm">
        <h2 className="mb-3 text-sm font-extrabold text-catcha-chocolate">
          ตารางนัด · Google Calendar
        </h2>
        <p className="mb-3 text-xs text-brown-soft">
          นัดจะซิงก์ไปปฏิทิน Catcha Hotel อัตโนมัติ (ต่อ API ในเฟสถัดไป)
        </p>
        <ul className="space-y-2">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center gap-2 rounded-catcha-sm border border-catcha-line bg-paper/50 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brown">
                  {b.catName} · {b.customerName}
                </p>
                <p className="text-xs text-brown-soft">
                  {b.date} {b.time || ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  b.status === "confirmed"
                    ? "bg-sage/20 text-ok"
                    : "bg-honey/25 text-wait"
                }`}
              >
                {b.status === "confirmed" ? "ยืนยันแล้ว" : "รอยืนยัน"}
              </span>
              {b.status === "pending" && (
                <button
                  type="button"
                  onClick={() => sendCard(b.id)}
                  className="rounded-full bg-latte/30 px-3 py-1.5 text-xs font-bold text-catcha-chocolate"
                >
                  📨 ส่งการ์ด
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "รอยืนยัน", val: bookings.filter((b) => b.status === "pending").length, emoji: "⏳" },
          { label: "ยืนยันแล้ว", val: bookings.filter((b) => b.status === "confirmed").length, emoji: "✅" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-catcha-sm bg-card p-4 text-center shadow-catcha-sm"
          >
            <p className="text-2xl">{s.emoji}</p>
            <p className="text-2xl font-extrabold text-latte-deep">{s.val}</p>
            <p className="text-xs text-brown-soft">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
