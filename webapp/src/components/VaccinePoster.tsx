"use client";

import { useL } from "@/components/LocaleProvider";

/** โปสเตอร์ "ทำไมต้องฉีดวัคซีนให้ครบก่อนมาอาบน้ำ" — หน้าอาบน้ำ + หน้าข้อตกลงก่อนอาบน้ำ */
export const VACCINE_POSTER = "/catalog/grooming/vaccine-before-bath.jpg";

export function VaccinePoster({ className = "" }: { className?: string }) {
  const { L } = useL();
  return (
    <div className={`overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={VACCINE_POSTER}
        alt={L("ทำไมต้องฉีดวัคซีนให้ครบก่อนมาอาบน้ำ — วัคซีนครบ = น้องปลอดภัย", "Why your cat must be fully vaccinated before a bath: vaccinated = safe")}
        width={853}
        height={1280}
        loading="lazy"
        className="block h-auto w-full"
      />
    </div>
  );
}
