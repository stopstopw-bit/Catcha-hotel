"use client";

import { useEffect, useMemo, useState } from "react";
import type { Booking } from "@/lib/business";
import { relevantAutoMessageTopics } from "@/lib/auto-messages";
import { savedPopup } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { GroomClashNote, confirmClashes, useGroomClashes } from "@/components/GroomClashNote";
import { Segmented } from "@/components/ui";
import { TransportPicker } from "@/components/TransportPicker";
import type { BookingTransport } from "@/lib/transport";
import { isUnknownCat, pickableCatNames } from "@/lib/unknown-cat";
import { GROOM_PROGRAMS, type GroomProgram } from "@/lib/grooming-prices";
import { freeUnitsForRange, roomCapacity, compositionOf, type BoardBooking, type RoomClosure } from "@/lib/room-board";
import { RoomMovesEditor } from "@/components/RoomMovesEditor";
import type { RoomSegment } from "@/lib/room-segments";
import { useConfig } from "@/components/ConfigProvider";
import { cardOn } from "@/lib/features";

export type EditableBooking = Booking & {
  lineUserId?: string;
  room?: string;
  checkin?: string;
  notes?: string;
  /** หัวข้อข้อความอัตโนมัติที่นัดนี้ปิดไว้ */
  autoOff?: string[];
  /** โปรแกรมอาบน้ำที่เลือกไว้ (id ของ GROOM_PROGRAMS) */
  groomProgram?: string;
  /** ห้องจริงที่ปักหมุดไว้ (เลข 1..จำนวนห้องของ room ประเภทนี้) */
  roomUnit?: number;
  /** ลูกค้ากดยอมรับข้อตกลงก่อนเข้าพักเมื่อไหร่ */
  consentAcceptedAt?: string;
  /** โน้ตดูแลเพิ่มเติมที่ลูกค้าพิมพ์มาตอนเซ็นยอมรับ */
  careNote?: string;
  /** ลายเซ็นที่เซ็นไว้ (URL รูป) */
  consentSignature?: string;
  /** ภาพสมุดวัคซีนที่แนบตอนยอมรับข้อตกลง */
  vaccinePhotoUrl?: string;
  /** ลูกค้าติ๊กยืนยันว่าหยดยาเห็บหมัดมาแล้ว — หลักฐานถ้าพบเห็บหมัดตอนเข้าพัก */
  fleaTickTreated?: boolean;
  /** เวลาที่เจ้าของแจ้งว่าจะมาส่งน้อง */
  arrivalTime?: string;
  /** เวลาที่เจ้าของแจ้งว่าจะมารับน้อง */
  pickupTime?: string;
  /** บริการรับ-ส่ง (ดู transport.ts) */
  transport?: BookingTransport;
  /** ย้ายห้องกลางทาง (ดู room-segments.ts) */
  roomSegments?: RoomSegment[];
};

function EditField({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  textarea,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  textarea?: boolean;
  onChange?: (v: string) => void;
}) {
  const cls =
    "mt-1 min-h-[44px] w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm text-brown";
  return (
    <label className="block text-xs font-bold text-brown-soft">
      {label}
      {textarea ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          className={cls}
          rows={2}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
          className={cls}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        />
      )}
    </label>
  );
}

export function BookingEditModal({
  booking,
  siblings = [],
  rooms,
  groomSlots,
  groomPrograms = GROOM_PROGRAMS,
  roomBookings = [],
  customerId,
  customerCats,
  takenCatNames,
  onClose,
  onSaved,
}: {
  booking: EditableBooking;
  /** นัดอื่นในบ้านเดียวกัน นัดเดียวกัน (ไม่รวมตัวที่กำลังแก้) — ไว้เสนอเลื่อนวันให้ทั้งหมดทีเดียว */
  siblings?: { id: string; catName: string }[];
  rooms: { id: string; name: string; size: string; price: number; count?: number; cats?: { th: string }; extra?: { th: string }; closures?: RoomClosure[] }[];
  groomSlots: string[];
  groomPrograms?: GroomProgram[];
  /** นัดห้องพักทั้งหมดที่ยังไม่ยกเลิก — ไว้คำนวณว่าห้องไหนว่างจริงตอนเลือกเลขห้อง */
  roomBookings?: BoardBooking[];
  /** ลูกค้าเจ้าของนัด — ไว้ดึงรายชื่อแมวที่บันทึกไว้มาให้เลือก (ถ้าไม่ส่ง customerCats มา) */
  customerId?: string;
  /** ชื่อแมวที่ลูกค้าบันทึกไว้ — แตะเลือกแทนการพิมพ์ชื่อใหม่ */
  customerCats?: string[];
  /** ชื่อแมวที่อยู่ในนัดเดียวกันแล้ว (ค่าเริ่มต้น = siblings) — ไม่ให้เลือกซ้ำ */
  takenCatNames?: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { config: siteConfig } = useConfig();
  const [service, setService] = useState<"groom" | "room">(
    booking.service || (booking.roomType || booking.checkin ? "room" : "groom")
  );
  const [saving, setSaving] = useState(false);
  const [catName, setCatName] = useState(booking.catName);
  const [savedCats, setSavedCats] = useState<string[]>(customerCats || []);
  useEffect(() => {
    if (customerCats || !customerId) return;
    let alive = true;
    fetch(`/api/customers?id=${encodeURIComponent(customerId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const cats = d?.customer?.cats as { name?: string }[] | undefined;
        if (alive && cats) setSavedCats(cats.map((c) => String(c.name || "")).filter(Boolean));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [customerId, customerCats]);
  const catChoices = pickableCatNames(savedCats, takenCatNames ?? siblings.map((s) => s.catName));
  const placeholderCat = isUnknownCat(booking.catName);
  const [roomSel, setRoomSel] = useState(booking.room || booking.roomType || "");
  const [checkinSel, setCheckinSel] = useState(booking.checkin || booking.date || "");
  const [checkoutSel, setCheckoutSel] = useState(booking.checkout || "");
  const [roomUnit, setRoomUnit] = useState<number | null>(booking.roomUnit ?? null);
  // ย้ายห้องกลางทาง — ส่งไปบันทึกเฉพาะตอนแก้จริง (ไม่งั้นเลื่อนวันแล้ววันย้ายเดิมจะทับที่ระบบขยับให้)
  const [roomMoves, setRoomMoves] = useState<RoomSegment[]>(booking.roomSegments || []);
  const [movesTouched, setMovesTouched] = useState(false);
  const firstOut = roomMoves.find((m) => m.from > checkinSel && (!checkoutSel || m.from < checkoutSel))?.from;
  /** นัดอื่นของร้าน ไม่รวมตัวนี้และน้องในบ้านเดียวกัน — ไว้คิดห้องว่างของช่วงย้ายห้อง */
  const otherStays = useMemo(() => {
    const own = new Set([booking.id, ...siblings.map((s) => s.id)]);
    return roomBookings.filter((b) => !own.has(b.id));
  }, [roomBookings, siblings, booking.id]);
  // เช็กคิวอาบน้ำชนเฉพาะตอนย้ายวัน/เวลา — นัดเดิมไม่ต้องเตือนซ้ำทุกครั้งที่แก้อย่างอื่น
  const [groomDate, setGroomDate] = useState(booking.date || "");
  const [groomTime, setGroomTime] = useState(booking.time || "12:30");
  const timeChanged = groomDate !== (booking.date || "") || groomTime !== (booking.time || "12:30");
  const clashes = useGroomClashes(service === "groom" && timeChanged ? groomDate : "", groomTime, [booking.id]);

  const boardRooms = useMemo(
    () => rooms.map((r) => ({ id: r.id, name: r.name, count: r.count || 0, maxCats: roomCapacity(r), closures: r.closures })),
    [rooms]
  );
  const freeUnits = useMemo(() => {
    if (!roomSel || !checkinSel || compositionOf(roomSel)) return [];
    return freeUnitsForRange(
      boardRooms,
      roomBookings,
      roomSel,
      checkinSel,
      firstOut || checkoutSel || checkinSel,
      booking.id
    );
  }, [boardRooms, roomBookings, roomSel, checkinSel, checkoutSel, firstOut, booking.id]);

  // เปลี่ยนห้อง/วัน แล้วเลขที่เคยเลือกไว้ไม่ว่างแล้ว → เคลียร์ทิ้ง (ให้ระบบเดาเองแทน)
  useEffect(() => {
    if (roomUnit != null && !freeUnits.includes(roomUnit)) setRoomUnit(null);
  }, [freeUnits, roomUnit]);
  // ค่าเริ่มต้นติ๊กไว้เลย — ปกติเจ้าของเลื่อนนัด ก็อยากเลื่อนให้ครบทุกตัวในบ้านอยู่แล้ว
  const [applyToSiblings, setApplyToSiblings] = useState(true);
  // ปิดข้อความอัตโนมัติเฉพาะนัดนี้ (คนละเรื่องกับปิดทั้งร้านในหน้าตั้งค่า)
  const [autoOff, setAutoOff] = useState<string[]>(booking.autoOff || []);
  const toggleAuto = (id: string) =>
    setAutoOff((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  // รับ/ส่งเอง แยกกัน — บางคนให้ร้านรับอย่างเดียว หรือส่งอย่างเดียวก็ได้
  // รับ = ร้านไปรับน้องจากบ้าน ไม่ต้องถามเวลาเช็คอิน, ส่ง = ร้านไปส่งน้องกลับบ้าน ไม่ต้องถามเวลาเช็คเอาท์
  // นัดเก่าที่ติ๊ก "ร้านไปรับ/ส่ง" ไว้ก่อนมีช่องรับ-ส่ง เก็บเป็นการปิดข้อความถามเวลา — อ่านมาเป็นค่าเริ่มต้น
  const [transport, setTransport] = useState<BookingTransport>(
    booking.transport || {
      pickup: booking.service === "room" && (booking.autoOff || []).includes("checkin"),
      dropoff: booking.service === "room" && (booking.autoOff || []).includes("checkout"),
    }
  );
  const changeTransport = (t: BookingTransport) => {
    // ฝากพัก: ร้านไปรับ = ไม่ต้องถามเวลาเช็คอิน, ร้านไปส่ง = ไม่ต้องถามเวลาเช็คเอาท์
    if (service === "room") {
      const sync = (prev: string[], topic: string, on: boolean) =>
        on ? Array.from(new Set([...prev, topic])) : prev.filter((x) => x !== topic);
      if (!!t.pickup !== !!transport.pickup) setAutoOff((p) => sync(p, "checkin", !!t.pickup));
      if (!!t.dropoff !== !!transport.dropoff) setAutoOff((p) => sync(p, "checkout", !!t.dropoff));
    }
    setTransport(t);
  };
  const transportPayload = transport.pickup || transport.dropoff ? transport : null;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (service === "groom" && !confirmClashes(clashes)) return;
    setSaving(true);
    const payload =
      service === "groom"
        ? {
            action: "update",
            customerName: String(fd.get("customer") || ""),
            catName: String(fd.get("cat") || ""),
            service: "groom" as const,
            date: String(fd.get("date") || ""),
            time: String(fd.get("time") || "") || undefined,
            groomProgram: String(fd.get("groomProgram") || "") || undefined,
            notes: String(fd.get("notes") || "") || undefined,
            arrivalTime: String(fd.get("arrivalTime") || "") || undefined,
            transport: transportPayload,
            autoOff,
          }
        : {
            action: "update",
            customerName: String(fd.get("customer") || ""),
            catName: String(fd.get("cat") || ""),
            service: "room" as const,
            room: String(fd.get("room") || "") || undefined,
            // ส่ง 0 เสมอเวลาไม่ได้ปักหมุด (ไม่ใช่ปล่อยว่าง) กันเคสอยากถอนหมุดที่เคยตั้งไว้ไม่ได้ผล
            roomUnit: fd.get("roomUnit") ? Number(fd.get("roomUnit")) || 0 : 0,
            checkin: String(fd.get("checkin") || ""),
            checkout: String(fd.get("checkout") || ""),
            date: String(fd.get("checkin") || ""),
            notes: String(fd.get("notes") || "") || undefined,
            arrivalTime: String(fd.get("arrivalTime") || "") || undefined,
            pickupTime: String(fd.get("pickupTime") || "") || undefined,
            transport: transportPayload,
            autoOff,
          };

    // 1) เลื่อนวัน/ต่อคืนก่อน — ทำฝั่งเซิร์ฟเวอร์ทีเดียวทั้งบ้าน และปรับบิลให้ตรงจำนวนคืน
    //    (ต้องทำก่อนแก้ข้อมูลอื่น เพราะเซิร์ฟเวอร์หาน้องตัวอื่นในบ้านจากวันที่เดิม)
    const datePatch =
      service === "groom"
        ? { date: String(fd.get("date") || ""), time: String(fd.get("time") || "") }
        : {
            checkin: String(fd.get("checkin") || ""),
            checkout: String(fd.get("checkout") || ""),
            date: String(fd.get("checkin") || ""),
          };
    const moved = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: booking.id,
        action: "reschedule",
        applyToGroup: applyToSiblings,
        ...datePatch,
      }),
    });
    const movedData = await moved.json().catch(() => ({}));
    if (!moved.ok) {
      setSaving(false);
      alert(
        movedData.error === "checkout_before_checkin"
          ? "วันออกต้องหลังวันเข้าพักนะ"
          : "เลื่อนวันไม่สำเร็จ"
      );
      return;
    }

    // 2) ข้อมูลอื่นของตัวนี้ (ชื่อ ห้อง โน้ต เวลา ฯลฯ)
    const res = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: booking.id, ...payload }),
    });

    if (!res.ok) {
      setSaving(false);
      alert("บันทึกไม่สำเร็จ");
      return;
    }

    // 3) ย้ายห้องกลางทาง — น้องในบ้านที่อยู่ห้องเดียวกัน (ช่วงห้องเดิมเหมือนกัน) ย้ายไปด้วยกัน
    if (service === "room" && movesTouched) {
      const sameRoom = (b?: { room?: string; roomSegments?: RoomSegment[] }) =>
        !!b &&
        (b.room || "") === (booking.room || booking.roomType || "") &&
        JSON.stringify(b.roomSegments || []) === JSON.stringify(booking.roomSegments || []);
      const mates = applyToSiblings
        ? siblings.filter((s) => sameRoom(roomBookings.find((b) => b.id === s.id)))
        : [];
      for (const id of [booking.id, ...mates.map((m) => m.id)]) {
        await fetch("/api/bookings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            action: "update",
            roomSegments: roomMoves,
            ...(id === booking.id ? {} : { room: payload.room }),
          }),
        });
      }
    }

    const count = Number(movedData.movedCount) || 1;
    const inv = movedData.invoice as
      | { kind: "none" }
      | { kind: "updated" | "created_extra"; nights: number; total: number }
      | { kind: "warn"; message: string }
      | undefined;
    // ปุ่มบันทึกอยู่ท้ายฟอร์มยาว — แจ้งผลเป็นป๊อปอัปกลางจอ รวมรายละเอียดไว้ในใบเดียว
    const lines: string[] = [];
    if (count > 1) lines.push(`เลื่อนให้ทั้งบ้านแล้ว (${count} ตัว)`);
    if (inv?.kind === "updated") {
      lines.push(`แก้บิลเดิมเป็น ${inv.nights} คืน · ${inv.total.toLocaleString()} บาท`);
    } else if (inv?.kind === "created_extra") {
      lines.push(`บิลเดิมปิดไปแล้ว — ออกบิลพักต่อ ${inv.nights} คืน · ${inv.total.toLocaleString()} บาท ไว้ในหน้าบิล`);
    }
    if (inv?.kind === "warn") {
      alert(`⚠️ ${inv.message}`);
    } else {
      savedPopup("บันทึกการแก้ไขแล้ว", lines);
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-catcha-chocolate/40 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-edit-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-card px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-catcha sm:rounded-catcha sm:p-5"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-catcha-line sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Edit booking</p>
            <h2 id="booking-edit-title" className="truncate text-lg font-extrabold text-catcha-chocolate">
              แก้ไขนัด · {booking.catName}
            </h2>
          </div>
          <button
            type="button"
            aria-label="ปิด"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-brown"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <Segmented
          value={service}
          onChange={setService}
          className="mb-4"
          options={[
            { id: "groom", label: "อาบน้ำ", icon: "bath" },
            { id: "room", label: "ห้องพัก", icon: "bed" },
          ]}
        />
        <form onSubmit={submit} className="space-y-3">
          <EditField label="ชื่อลูกค้า" name="customer" defaultValue={booking.customerName} required />
          <div>
            <label className="block text-xs font-bold text-brown-soft">
              ชื่อน้องแมว
              <input
                name="cat"
                value={catName}
                required
                onChange={(e) => setCatName(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm text-brown"
              />
            </label>
            {catChoices.length > 0 && (
              <div
                className={`mt-2 rounded-catcha-sm p-2.5 ${
                  placeholderCat ? "border border-latte-deep/40 bg-latte/15" : "bg-paper/60"
                }`}
              >
                <p className="mb-2 text-[11px] font-bold text-brown-soft">
                  {placeholderCat ? "ลูกค้าบันทึกแมวไว้แล้ว · แตะเลือกตัวที่ใช่" : "แมวของลูกค้า · แตะเพื่อเลือก"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {catChoices.map((n) => {
                    const on = catName.trim() === n.trim();
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setCatName(on ? booking.catName : n)}
                        className={`inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 text-xs font-bold transition ${
                          on
                            ? "border-catcha-chocolate bg-catcha-chocolate text-white"
                            : "border-catcha-line bg-card text-brown"
                        }`}
                      >
                        {on && <Icon name="check" size={14} />}
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {service === "groom" ? (
            <>
              <EditField label="วันที่นัด" name="date" type="date" defaultValue={booking.date} required onChange={setGroomDate} />
              <label className="block text-xs font-bold text-brown-soft">
                รอบเวลา
                <input
                  name="time"
                  type="time"
                  list="edit-groom-slots"
                  defaultValue={booking.time || "12:30"}
                  onChange={(e) => setGroomTime(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm text-brown"
                />
                <datalist id="edit-groom-slots">
                  {groomSlots.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <GroomClashNote clashes={clashes} />
              </label>
              <label className="block text-xs font-bold text-brown-soft">
                โปรแกรมอาบน้ำ
                <select
                  name="groomProgram"
                  defaultValue={booking.groomProgram || ""}
                  className="mt-1 min-h-[44px] w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm text-brown"
                >
                  <option value="">— ยังไม่ระบุ (เลือกตอนคิดเงิน) —</option>
                  {groomPrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <EditField
                label="เวลาที่ลูกค้าแจ้งจะมาส่งน้อง (ถ้ามี)"
                name="arrivalTime"
                type="time"
                defaultValue={booking.arrivalTime || ""}
              />
            </>
          ) : (
            <>
              <label className="block text-xs font-bold text-brown-soft">
                ห้อง
                <select
                  name="room"
                  defaultValue={booking.room || booking.roomType || ""}
                  onChange={(e) => setRoomSel(e.target.value)}
                  className="mt-1 min-h-[44px] w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm text-brown"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.size})
                    </option>
                  ))}
                </select>
              </label>
              {roomSel && !compositionOf(roomSel) && (
                <div className="rounded-catcha-sm border border-catcha-line bg-paper/50 p-3">
                  <input type="hidden" name="roomUnit" value={roomUnit ?? ""} />
                  <p className="flex items-center gap-1.5 text-xs font-bold text-brown-soft">
                    <Icon name="grid" size={14} />
                    เลือกห้องจริง (ไม่บังคับ)
                  </p>
                  <p className="mb-2 text-[10px] text-brown-faint">
                    ไม่เลือก = ให้ระบบจัดห้องให้อัตโนมัติ
                  </p>
                  {freeUnits.length === 0 ? (
                    <p className="text-[10px] text-brown-faint">ไม่มีห้องว่างให้เลือกช่วงนี้</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {freeUnits.map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setRoomUnit(roomUnit === u ? null : u)}
                          aria-pressed={roomUnit === u}
                          className={`flex min-h-[40px] items-center gap-1 rounded-full px-3.5 text-xs font-bold transition ${
                            roomUnit === u
                              ? "bg-catcha-chocolate text-card"
                              : "bg-card text-brown-soft ring-1 ring-catcha-line hover:bg-honey/20"
                          }`}
                        >
                          {roomUnit === u && <Icon name="check" size={14} strokeWidth={2.4} />}
                          ห้อง {u}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <EditField
                label="เช็คอิน"
                name="checkin"
                type="date"
                defaultValue={booking.checkin || booking.date}
                onChange={setCheckinSel}
                required
              />
              <EditField
                label="เช็คเอาท์"
                name="checkout"
                type="date"
                defaultValue={booking.checkout || ""}
                onChange={setCheckoutSel}
                required
              />
              {roomSel && (
                <RoomMovesEditor
                  rooms={rooms}
                  boardRooms={boardRooms}
                  existing={otherStays}
                  checkin={checkinSel}
                  checkout={checkoutSel}
                  firstRoom={roomSel}
                  firstUnit={roomUnit}
                  moves={roomMoves}
                  onChange={(m) => {
                    setRoomMoves(m);
                    setMovesTouched(true);
                  }}
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <EditField
                    label="เวลาส่งน้อง (ถ้ามี)"
                    name="arrivalTime"
                    type="time"
                    defaultValue={booking.arrivalTime || ""}
                  />
                </div>
                <div className="min-w-0">
                  <EditField
                    label="เวลารับน้อง (ถ้ามี)"
                    name="pickupTime"
                    type="time"
                    defaultValue={booking.pickupTime || ""}
                  />
                </div>
              </div>
            </>
          )}
            <label className="flex items-start gap-2.5 rounded-catcha-sm border border-honey-deep/40 bg-honey/15 p-3 text-xs font-bold text-catcha-chocolate">
              <input
                type="checkbox"
                checked={applyToSiblings}
                onChange={(e) => setApplyToSiblings(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-latte-deep"
              />
              <span>
                เลื่อนวัน{service === "groom" ? "/เวลา" : "เข้า-ออก"}ให้ทั้งบ้านด้วย
                <span className="block font-normal text-brown-faint">
                  {siblings.length > 0
                    ? `${siblings.map((s) => s.catName).join(", ")} (${siblings.length} ตัว)`
                    : "ทุกตัวในบ้านที่มานัดเดียวกัน (ถ้ามี)"}{" "}
                  — เปลี่ยนแค่วันที่/เวลา ชื่อและโน้ตของแต่ละตัวไม่ถูกแตะ
                  {service === "room" && " · บิลห้องพักจะปรับจำนวนคืนให้เอง"}
                </span>
              </span>
            </label>
          <TransportPicker value={transport} onChange={changeTransport} />
          <EditField label="โน้ต" name="notes" defaultValue={booking.notes || ""} textarea />

          {/* ปิดข้อความอัตโนมัติเฉพาะเคสนี้ — เช่น ลูกค้าประจำที่คุยกันทางแชทอยู่แล้ว */}
          <div className="rounded-catcha-sm border border-catcha-line bg-paper/50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-extrabold text-catcha-chocolate">
              <Icon name="message" size={14} />
              ไม่ต้องส่งอัตโนมัติ (เฉพาะนัดนี้)
            </p>
            <p className="mb-2 mt-0.5 text-[10px] text-brown-faint">
              ติ๊กหัวข้อที่ไม่อยากให้ระบบส่งหาลูกค้ารายนี้ · ไม่กระทบนัดอื่น
            </p>
            <div>
              {relevantAutoMessageTopics(service).filter((t) => cardOn(siteConfig, t.id)).map((t) => (
                <label key={t.id} className="flex min-h-[40px] items-center gap-2.5 text-xs font-bold text-brown-soft">
                  <input
                    type="checkbox"
                    checked={autoOff.includes(t.id)}
                    onChange={() => toggleAuto(t.id)}
                    className="h-4 w-4 shrink-0 accent-latte-deep"
                  />
                  {t.label}
                </label>
              ))}
            </div>
            {autoOff.length > 0 && (
              <p className="mt-2 rounded bg-honey/20 px-2 py-1 text-[10px] font-bold text-catcha-chocolate">
                ปิดอยู่ {autoOff.length} หัวข้อ — ส่งเองด้วยปุ่มส่งการ์ดได้ตามปกติ
              </p>
            )}
          </div>
          <div className="sticky bottom-0 -mx-4 bg-card px-4 pb-1 pt-2 sm:-mx-5 sm:px-5">
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-catcha-chocolate text-sm font-extrabold text-card shadow-catcha-sm disabled:opacity-50"
            >
              <Icon name="check" size={18} strokeWidth={2.2} />
              {saving ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
