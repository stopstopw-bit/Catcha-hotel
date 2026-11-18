"use client";

import Image from "next/image";
import { useLocale } from "@/components/LocaleProvider";
import { posterFor } from "@/lib/en-posters";

/** แสดงโปสเตอร์ห้องเต็มใบ — ไม่ crop */
export function RoomPoster({
  src,
  alt,
  priority,
  className = "",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
}) {
  const { locale } = useLocale();
  return (
    <div
      className={`overflow-hidden rounded-catcha border border-catcha-line bg-paper ${className}`}
    >
      <Image
        src={posterFor(src, locale)}
        alt={alt}
        width={1200}
        height={1600}
        priority={priority}
        className="h-auto w-full object-contain"
        sizes="(max-width: 512px) 100vw, 480px"
      />
    </div>
  );
}
