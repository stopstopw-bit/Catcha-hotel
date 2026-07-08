"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoomType } from "@/lib/business";
import type { CustomerRecord } from "@/lib/customers-store";

type CustomerListItem = CustomerRecord & { upcomingAppointments?: number };

type PickedCustomer = {
  customerId: string;
  customerName: string;
  catName: string;
  lineUserId?: string;
  staffNote?: string;
  isMember?: boolean;
};

function CustomerPicker({
  selected,
  onSelect,
  onClear,
}: {
  selected: PickedCustomer | null;
  onSelect: (data: PickedCustomer) => void;
  onClear: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const params = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      const res = await fetch(`/api/customers${params}`);
      const data = await res.json();
      setResults((data.customers || []).slice(0, 15));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || selected) return;
    const t = setTimeout(() => load(q), q.trim() ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, open, load, selected]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (c: CustomerListItem, cat: { name: string; staffNote?: string }) => {
    onSelect({
      customerId: c.id,
      customerName: c.name,
      catName: cat.name,
      lineUserId: c.lineUserId,
      staffNote: cat.staffNote,
      isMember: c.isMember,
    });
    setQ("");
    setResults([]);
    setOpen(false);
  };

  if (selected) {
    return (
      <div className="rounded-catcha-sm border border-sage/50 bg-sage/10 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold text-brown-soft">ลูกค้าเก่า</p>
            <p className="text-sm font-extrabold text-brown">
              🐱 {selected.catName} · {selected.customerName}
              {selected.isMember && <span className="text-latte-deep"> 💎</span>}
            </p>
            {selected.lineUserId && (
              <p className="mt-0.5 text-[10px] font-bold text-ok">LINE ผูกแล้ว — ลูกค้าเห็นนัดในแอป</p>
            )}
            {selected.staffNote && (
              <p className="mt-0.5 text-[10px] text-brown-soft">โน้ต: {selected.staffNote}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[10px] font-bold text-brown-soft"
          >
            เปลี่ยน
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative rounded-catcha-sm border border-latte/40 bg-honey/10 p-3">
      <label className="block text-xs font-extrabold text-catcha-chocolate">
        🔍 ค้นหาลูกค้าเก่า
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (!q.trim()) load("");
          }}
          placeholder="ชื่อลูกค้า / ชื่อแมว / เบอร์โทร"
          className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-latte-deep"
        />
      </label>
      <p className="mt-1 text-[10px] text-brown-soft">
        เลือกจากรายการ → ใส่ชื่อ + LINE ให้อัตโนมัติ · หรือกรอกด้านล่างถ้าเป็นลูกค้าใหม่
      </p>

      {open && (
        <ul className="absolute left-0 right-0 z-20 mt-1 max-h-52 overflow-y-auto rounded-catcha-sm border border-catcha-line bg-card shadow-catcha">
          {loading && <li className="px-3 py-2 text-xs text-brown-soft">กำลังโหลด…</li>}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-xs text-brown-soft">
              {q.trim() ? "ไม่พบ — กรอกด้านล่างเป็นลูกค้าใหม่" : "ยังไม่มีลูกค้าในระบบ"}
            </li>
          )}
          {!loading &&
            results.map((c) =>
              (c.cats.length ? c.cats : [{ id: "—", name: "—" }]).map((cat) => (
                <li key={`${c.id}-${cat.id}`}>
                  <button
                    type="button"
                    onClick={() => pick(c, cat)}
                    className="w-full border-b border-catcha-line/50 px-3 py-2.5 text-left last:border-0 hover:bg-honey/15"
                  >
                    <span className="text-sm font-bold text-brown">
                      🐱 {cat.name} · {c.name}
                      {c.isMember && <span className="text-latte-deep"> 💎</span>}
                    </span>
                    {cat.staffNote && (
                      <span className="mt-0.5 block text-[10px] text-brown-soft">{cat.staffNote}</span>
                    )}
                    {c.phone && (
                      <span className="mt-0.5 block text-[10px] text-brown-faint">📞 {c.phone}</span>
                    )}
                  </button>
                </li>
              ))
            )}
        </ul>
      )}
    </div>
  );
}

type SaveResult = {
  ok: boolean;
  calendarLink?: string;
  calendarMock?: boolean;
  error?: string;
};

export default function NewBookingPage() {
  const [service, setService] = useState<"groom" | "room">("groom");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [groomSlots, setGroomSlots] = useState<string[]>(["09:30", "12:30", "15:30"]);
  const [picked, setPicked] = useState<PickedCustomer | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [catName, setCatName] = useState("");
  const [lineUserId, setLineUserId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.config?.rooms) setRooms(d.config.rooms);
        if (d.config?.groomSlots) setGroomSlots(d.config.groomSlots);
      });
  }, []);

  const clearCustomer = () => {
    setPicked(null);
    setCustomerName("");
    setCatName("");
    setLineUserId("");
    setNotes("");
  };

  const applyPick = (data: PickedCustomer) => {
    setPicked(data);
    setCustomerName(data.customerName);
    setCatName(data.catName);
    setLineUserId(data.lineUserId || "");
    if (data.staffNote) setNotes(data.staffNote);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const form = e.currentTarget;
    const fd = new FormData(form);
    const cat = catName.trim() || String(fd.get("cat") || "").trim();
    if (!cat) {
      alert("กรอกชื่อน้องแมวอย่างน้อย 1 ชื่อ");
      return;
    }

    const payload = {
      customerId: picked?.customerId,
      customerName: customerName.trim() || String(fd.get("customer") || "").trim() || undefined,
      catName: cat,
      lineUserId: lineUserId.trim() || undefined,
      service,
      date: service === "groom" ? String(fd.get("date") || "") : undefined,
      time: service === "groom" ? String(fd.get("time") || "") : undefined,
      room: service === "room" ? String(fd.get("room") || "") : undefined,
      checkin: service === "room" ? String(fd.get("checkin") || "") : undefined,
      checkout: service === "room" ? String(fd.get("checkout") || "") : undefined,
      notes: notes.trim() || String(fd.get("notes") || "") || undefined,
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
          calendarLink: data.calendar?.htmlLink || data.calendar?.googleUrl,
          calendarMock: Boolean(data.calendar?.mock),
        });
        clearCustomer();
        form.reset();
      } else {
        setResult({ ok: false, error: data.error || "บันทึกไม่สำเร็จ" });
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
        <CustomerPicker selected={picked} onSelect={applyPick} onClear={clearCustomer} />

        <Field
          label="ชื่อลูกค้า"
          name="customer"
          value={customerName}
          onChange={setCustomerName}
          placeholder="คุณมาย"
        />
        <Field
          label="ชื่อน้องแมว *"
          name="cat"
          value={catName}
          onChange={setCatName}
          required
          placeholder="น้องส้ม"
        />

        {!picked?.lineUserId && (
          <Field
            label="LINE User ID (ถ้ามี)"
            name="lineId"
            value={lineUserId}
            onChange={setLineUserId}
            placeholder="Uxxxxxxxx..."
          />
        )}

        {lineUserId && (
          <p className="rounded-catcha-sm bg-sage/15 px-3 py-2 text-[10px] font-bold text-ok">
            ✅ ผูก LINE แล้ว — ลูกค้าเห็นนัดในแอปอัตโนมัติ
          </p>
        )}

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

        <Field
          label="โน้ตนิสัยน้อง"
          name="notes"
          textarea
          value={notes}
          onChange={setNotes}
          placeholder="เช่น แมวดุ อาบยาก (ดึงจากประวัติอัตโนมัติถ้าเลือกลูกค้าเก่า)"
        />

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
                {result.calendarLink && !result.calendarMock ? (
                  <a
                    href={result.calendarLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs font-bold underline"
                  >
                    📅 เปิดนัดใน Google Calendar
                  </a>
                ) : null}
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
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  textarea?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const cls =
    "mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-latte-deep";
  return (
    <label className="block text-xs font-bold text-brown-soft">
      {label}
      {textarea ? (
        <textarea
          name={name}
          className={cls}
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        />
      ) : (
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={cls}
        />
      )}
    </label>
  );
}
