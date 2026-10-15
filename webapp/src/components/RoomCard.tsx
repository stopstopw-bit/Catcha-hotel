"use client";

import Link from "next/link";
import type { RoomType } from "@/lib/business";
import type { Locale } from "@/lib/business";
import { RoomPoster } from "@/components/RoomPoster";
import { t } from "@/lib/i18n";
import { Icon } from "@/components/Icon";

export function RoomCard({
  room,
  locale,
}: {
  room: RoomType;
  locale: Locale;
}) {
  const m = t(locale).rooms;

  return (
    <Link
      href={`/app/rooms/${room.id}`}
      className="block overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm transition active:scale-[0.99]"
    >
      <RoomPoster src={room.image} alt={room.name} />
      <div className="flex min-h-[56px] items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-catcha-chocolate">
            {room.name}
          </p>
          <p className="text-[11px] text-brown-soft">
            {room.price} {m.perNight} · {m.tapToView}
          </p>
        </div>
        <Icon name="chevron" size={18} className="text-brown-faint" />
      </div>
    </Link>
  );
}
