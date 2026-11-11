"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { toJpegDataUrl } from "@/lib/image-convert";

/**
 * ตัวแก้รูปของฟอร์มลูกค้าในหลังบ้าน — เพิ่มได้หลายรูป ลบ/เลื่อนลำดับได้ กลับไปใช้รูปเริ่มต้นได้
 * รูปที่อัปเป็น data URL → ตอนบันทึก config-store ย้ายขึ้น Storage ให้เอง (ไม่ยัด base64 ใน config)
 */
export function FormPosterEditor({
  images,
  hint,
  emptyText = "ยังไม่มีรูป — ลูกค้าจะเข้าหน้าคำถามเลย",
  isDefault,
  hasDefault,
  onChange,
  onUseDefault,
}: {
  images: string[];
  hint: string;
  /** ข้อความตอนยังไม่มีรูป */
  emptyText?: string;
  /** ยังใช้รูปเริ่มต้นอยู่ (ร้านยังไม่เคยแก้) */
  isDefault: boolean;
  /** ฟอร์มนี้มีรูปเริ่มต้นให้กลับไปใช้ได้ */
  hasDefault: boolean;
  onChange: (next: string[]) => void;
  onUseDefault: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const smallBtn =
    "flex h-9 w-9 items-center justify-center rounded-full bg-card text-brown shadow-catcha-sm disabled:opacity-30";

  return (
    <div className="rounded-catcha-sm border border-catcha-line bg-paper p-3">
      <p className="flex items-center gap-1.5 text-sm font-extrabold text-catcha-chocolate">
        <Icon name="image" size={16} />
        รูปในฟอร์ม
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-brown-soft">{hint}</p>

      {images.length === 0 ? (
        <p className="mt-3 rounded-catcha-sm bg-card px-3 py-3 text-center text-xs text-brown-soft">
          {emptyText}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {images.map((src, i) => (
            <div key={`${i}-${src.slice(-24)}`} className="flex items-center gap-3 rounded-catcha-sm bg-card p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`รูปที่ ${i + 1}`} className="h-20 w-16 shrink-0 rounded-md border border-catcha-line object-cover" />
              <span className="flex-1 text-xs font-bold text-brown">รูปที่ {i + 1}</span>
              <button type="button" aria-label="เลื่อนขึ้น" className={smallBtn} disabled={i === 0} onClick={() => move(i, -1)}>
                <Icon name="chevron" size={14} className="-rotate-90" />
              </button>
              <button
                type="button"
                aria-label="เลื่อนลง"
                className={smallBtn}
                disabled={i === images.length - 1}
                onClick={() => move(i, 1)}
              >
                <Icon name="chevron" size={14} className="rotate-90" />
              </button>
              <button
                type="button"
                aria-label="ลบรูป"
                className={`${smallBtn} text-red-600`}
                onClick={() => onChange(images.filter((_, k) => k !== i))}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <label className="flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full bg-catcha-chocolate px-3.5 text-xs font-extrabold text-card">
          <Icon name="plus" size={14} />
          {busy ? "กำลังอัป…" : "เพิ่มรูป"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              e.target.value = "";
              if (files.length === 0) return;
              setBusy(true);
              try {
                const added: string[] = [];
                for (const f of files) added.push(await toJpegDataUrl(f, 1600));
                onChange([...images, ...added]);
              } catch (err) {
                alert(err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ");
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {hasDefault && !isDefault && (
          <button
            type="button"
            onClick={onUseDefault}
            className="min-h-[40px] rounded-full bg-card px-3.5 text-xs font-bold text-brown"
          >
            ใช้รูปเริ่มต้น
          </button>
        )}
      </div>
    </div>
  );
}
