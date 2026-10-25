"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

export type RoomOption = { id: string; name: string; price: number };

/** ห้องจากตั้งค่าร้าน — โหลดครั้งเดียว */
export function useRoomOptions(): RoomOption[] {
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setRooms(
          ((d.config?.rooms || []) as RoomOption[]).map((r) => ({
            id: r.id,
            name: r.name,
            price: Number(r.price) || 0,
          }))
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return rooms;
}

/**
 * เลือกว่าคอร์สวันพักใช้กับห้องไหน — ห้องแต่ละแบบราคาไม่เท่ากัน
 * "" = ทุกห้อง (แบบเดิม) · เลือกห้อง = ตอนออกบิลหักเฉพาะคืนของห้องนั้น
 * ใส่จำนวนคืนมาด้วยจะบอกราคาเต็มของห้องนั้น ไว้ตั้งราคาคอร์ส
 */
export function RoomTypePicker({
  value,
  onChange,
  rooms,
  nights,
  price,
}: {
  value: string;
  onChange: (id: string) => void;
  rooms: RoomOption[];
  nights?: number;
  /** ราคาคอร์สที่กรอก — บอกว่าถูกกว่าราคาเต็มกี่ % */
  price?: number;
}) {
  const chip = (active: boolean) =>
    `flex min-h-[36px] items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${
      active ? "bg-catcha-chocolate text-card" : "bg-paper text-brown-soft"
    }`;
  const room = rooms.find((r) => r.id === value);
  const full = room && nights && nights > 0 ? room.price * nights : 0;
  const off = full && price && price > 0 ? Math.round(((full - price) / full) * 100) : 0;
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold text-brown-soft">ใช้กับห้อง</span>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => onChange("")} className={chip(!value)}>
          {!value && <Icon name="check" size={13} strokeWidth={2.4} />}
          ทุกห้อง
        </button>
        {rooms.map((r) => (
          <button key={r.id} type="button" onClick={() => onChange(r.id)} className={chip(value === r.id)}>
            {value === r.id && <Icon name="check" size={13} strokeWidth={2.4} />}
            {r.name}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-[11px] text-brown-faint">
        {room
          ? full
            ? `ราคาเต็ม ${room.price.toLocaleString()} × ${nights} คืน = ${full.toLocaleString()}฿` +
              (off > 0 ? ` · คอร์สนี้ถูกกว่า ${off}%` : ` · ลด 30% = ${Math.round(full * 0.7).toLocaleString()}฿`)
            : `ตอนออกบิลหักเฉพาะคืนของห้อง ${room.name} (คืนละ ${room.price.toLocaleString()}฿)`
          : "ห้องแต่ละแบบราคาไม่เท่ากัน แนะนำให้เลือกห้อง แล้วตั้งคอร์สแยกห้องละอัน"}
      </p>
    </div>
  );
}
