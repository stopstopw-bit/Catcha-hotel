"use client";

import { useEffect, useState } from "react";
import type { RoomType } from "@/lib/business";

type SaveResult = {
  ok: boolean;
  bookingId?: string;
  calendarLink?: string;
  calendarMock?: boolean;
  calendarReason?: string;
  error?: string;
};

export default function NewBookingPage() {
  const [service, setService] = useState<"groom" | "room">("groom");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [groomSlots, setGroomSlots] = useState<string[]>(["09:30", "12:30", "15:30"]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.config?.rooms) setRooms(d.config.rooms);
        if (d.config?.groomSlots) setGroomSlots(d.config.groomSlots);
      });
  }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const form = e.currentTarget;
    const fd = new FormData(form);
    const payload = {
      customerName: String(fd.get("customer") || ""),
      catName: String(fd.get("cat") || ""),
      lineUserId: String(fd.get("lineId") || "") || undefined,
      service,
      date: service === "groom" ? String(fd.get("date") || "") : undefined,
      time: service === "groom" ? String(fd.get("time") || "") : undefined,
      room: service === "room" ? String(fd.get("room") || "") : undefined,
      checkin: service === "room" ? String(fd.get("checkin") || "") : undefined,
      checkout: service === "room" ? String(fd.get("checkout") || "") : undefined,
      notes: String(fd.get("notes") || "") || undefined,
    };

    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setResult({
          ok: true,
          bookingId: data.booking?.id,
          calendarLink: data.calendar?.htmlLink || data.calendar?.googleUrl,
          calendarMock: Boolean(data.calendar?.mock),
          calendarReason: data.calendar?.reason,
        });
        form.reset();
      } else {
        setResult({
          ok: false,
          error: data.error || "บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง",
        });
      }
    } catch {
      setResult({ ok: false, error: "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">
        ➕ บันทึกจองให้ลูกค้า
      </h1>

      <div className="mb-4 flex gap-2">
        {(
          [
            { id: "groom" as const, label: "🛁 อาบน้ำ" },
            { id: "room" as const, label: "🏠 ห้องพัก" },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setService(s.id)}
            className={`flex-1 rounded-catcha-sm py-3 text-sm font-bold ${
              service === s.id
                ? "bg-honey/45 text-catcha-chocolate shadow-catcha-sm"
                : "bg-paper text-brown-soft"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-catcha bg-card p-5 shadow-catcha-sm">
        <Field label="ชื่อลูกค้า" name="customer" required />
        <Field label="ชื่อน้องแมว" name="cat" required />
        <Field label="LINE User ID (ถ้ามี)" name="lineId" placeholder="Uxxxxxxxx..." />

        {service === "groom" ? (
          <>
            <Field label="วันที่นัด" name="date" type="date" required />
            <label className="block text-xs font-bold text-brown-soft">
              รอบเวลา
              <input
                name="time"
                type="time"
                list="groom-slots"
                defaultValue="12:30"
                className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
              />
              <datalist id="groom-slots">
                {groomSlots.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <p className="mt-1 text-[10px] text-brown-faint">
                เลือกจากรอบแนะนำ หรือพิมพ์เวลาเองได้
              </p>
            </label>
          </>
        ) : (
          <>
            <label className="block text-xs font-bold text-brown-soft">
              ห้อง
              <select
                name="room"
                className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.size}) — {r.price} บาท/คืน
                    {r.count ? ` · ${r.count} ห้อง` : " · ห้องเชื่อม"}
                  </option>
                ))}
              </select>
            </label>
            <Field label="เช็คอิน" name="checkin" type="date" required />
            <Field label="เช็คเอาท์" name="checkout" type="date" required />
          </>
        )}

        <Field label="โน้ตนิสัยน้อง (ลูกค้าใหม่)" name="notes" textarea />

        {result && (
          <div
            className={`rounded-catcha-sm border px-4 py-3 text-sm ${
              result.ok
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-red-200 bg-red-50 text-red-900"
            }`}
          >
            {result.ok ? (
              <div className="space-y-2">
                <p className="font-extrabold">✅ บันทึกการจองแล้ว</p>
                {result.bookingId && (
                  <p className="text-xs text-green-800">รหัสจอง: {result.bookingId}</p>
                )}
                {result.calendarLink && !result.calendarMock ? (
                  <>
                    <p className="text-xs">สร้างนัดใน Google Calendar แล้ว</p>
                    <a
                      href={result.calendarLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded-catcha-sm bg-white px-3 py-2 text-xs font-bold text-catcha-chocolate shadow-sm underline"
                    >
                      📅 เปิดนัดใน Google Calendar
                    </a>
                    <p className="text-[10px] leading-relaxed text-green-800">
                      ถ้าไม่เห็นในปฏิทินหลัก → เปิด Google Calendar แล้วติ๊กปฏิทิน
                      <strong> Catcha Hotel </strong>
                      ทางซ้ายมือ
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-amber-800">
                    ⚠️ บันทึกจองแล้ว แต่ยังสร้างนัด Calendar อัตโนมัติไม่ได้
                    {result.calendarReason ? ` (${result.calendarReason})` : ""}
                    — ไปที่ Admin → ตั้งค่า → Google แล้วกดทดสอบอีกครั้ง
                  </p>
                )}
              </div>
            ) : (
              <p className="font-bold">❌ {result.error}</p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-catcha-sm bg-gradient-to-r from-honey to-honey-deep py-3.5 text-sm font-extrabold text-catcha-chocolate disabled:opacity-60"
        >
          {submitting ? "กำลังบันทึก…" : "🗓️ บันทึกการจอง + สร้างนัด Calendar"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  textarea,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  textarea?: boolean;
}) {
  const cls =
    "mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-latte-deep";
  return (
    <label className="block text-xs font-bold text-brown-soft">
      {label}
      {textarea ? (
        <textarea name={name} className={cls} rows={2} />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  );
}
