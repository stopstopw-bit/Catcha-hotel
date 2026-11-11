"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

/**
 * การ์ดโปร/คอร์สบนหน้าเว็บ — การ์ดสั้นเท่ากันทุกใบ (รูป · ชื่อ 2 บรรทัด · ป้าย · คำอธิบาย 2 บรรทัด · ราคา)
 * กดการ์ดเปิดแผ่นรายละเอียดเต็ม (มือถือเลื่อนขึ้นจากล่าง / คอมเป็นกล่องกลางจอ)
 * มือถือเลื่อนการ์ดซ้าย-ขวาแบบแอป ไม่ต้องไถยาวลงไปทีละใบ
 */

export type PublicOfferItem = {
  id: string;
  title: string;
  imageUrl?: string;
  chips: string[];
  body?: string;
  price?: number;
  /** ข้อความตัวเล็กใต้ชื่อ เช่น "ถึง 30 ธ.ค. 69" */
  note?: string;
  /** ป้ายบนรูป เช่น "ลด 30%" */
  badge?: string;
  /** คอร์สเดียวกันหลายห้อง รวมเป็นการ์ดใบเดียว — ราคาบนการ์ดเป็น "เริ่ม" ราคาต่ำสุด, ในแผ่นรายละเอียดเป็นตารางราคาแต่ละห้อง */
  options?: { label: string; sub?: string; price: number }[];
};

function PriceTag({
  item,
  size,
}: {
  item: PublicOfferItem;
  size: "sm" | "lg";
}) {
  if (typeof item.price !== "number") return <span />;
  const from = (item.options?.length || 0) > 1;
  return (
    <p
      className={`${size === "lg" ? "text-xl" : "text-lg"} font-extrabold leading-none text-latte-deep`}
    >
      {from && (
        <span className="text-xs font-bold text-brown-faint">เริ่ม </span>
      )}
      {item.price.toLocaleString()}
      <span className="text-xs font-bold text-brown-faint"> บาท</span>
    </p>
  );
}

/** อิโมจิ/สัญลักษณ์ตกแต่ง — ตัดออกเฉพาะบนการ์ด (ในแผ่นรายละเอียดยังโชว์ครบ) */
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;
function plain(s: string) {
  return s
    .replace(EMOJI, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * คำอธิบายที่พิมพ์ติดกันเป็นก้อนเดียว (ไม่มีขึ้นบรรทัด) → แยกบรรทัดให้อ่านง่ายในแผ่นรายละเอียด
 * ขึ้นบรรทัดใหม่ก่อน " - " (หัวข้อย่อย), ก่อน "1. 2. 3." และก่อน 📌 ✨ ที่ใช้เปิดหัวข้อ
 * ถ้าร้านขึ้นบรรทัดเองอยู่แล้วก็ใช้ตามนั้น
 */
export function formatDetail(text: string): string {
  if (text.includes("\n")) return text.trim();
  return text
    .replace(/\s+-\s+/g, "\n• ")
    .replace(/\s+(\d{1,2})\.\s+/g, "\n$1. ")
    .replace(/\s*(📌|✨)\s*/gu, "\n\n$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** มีอะไรให้ดูเพิ่มไหม — ข้อความสั้นไม่มีรูป อ่านจบบนการ์ดแล้ว ไม่ต้องมีปุ่ม */
function hasMore(item: PublicOfferItem) {
  return (
    Boolean(item.imageUrl) ||
    (item.body || "").length > 70 ||
    (item.body || "").includes("\n")
  );
}

function OfferCard({
  item,
  onOpen,
}: {
  item: PublicOfferItem;
  onOpen: () => void;
}) {
  const more = hasMore(item);
  return (
    <button
      type="button"
      data-offer-open={more ? "" : undefined}
      onClick={more ? onOpen : undefined}
      disabled={!more}
      className="group flex h-full w-full flex-col overflow-hidden rounded-catcha border border-catcha-line bg-card text-left shadow-catcha-sm transition enabled:active:scale-[0.98] disabled:cursor-default"
    >
      {item.imageUrl ? (
        <div className="relative aspect-square w-full bg-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={plain(item.title)}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain"
          />
          {item.badge && (
            <span className="absolute left-3 top-3 rounded-full bg-catcha-chocolate px-2.5 py-1 text-[11px] font-extrabold text-card shadow-catcha-sm">
              {item.badge}
            </span>
          )}
        </div>
      ) : item.badge ? (
        <div className="px-4 pt-4">
          <span className="rounded-full bg-catcha-chocolate px-2.5 py-1 text-[11px] font-extrabold text-card">
            {item.badge}
          </span>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 text-sm font-extrabold leading-snug text-catcha-chocolate">
          {plain(item.title)}
        </p>
        {item.chips.length > 0 && (
          <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
            {item.chips.slice(0, 2).map((c) => (
              <span
                key={c}
                className="max-w-full truncate rounded-full bg-sage/20 px-2 py-0.5 text-[11px] font-bold text-ok"
              >
                {c}
              </span>
            ))}
          </div>
        )}
        {item.body && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-brown-soft">
            {plain(item.body)}
          </p>
        )}
        {item.note && (
          <p className="mt-2 text-[11px] font-bold text-latte-deep">
            {item.note}
          </p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <PriceTag item={item} size="sm" />
          {more && (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-latte/20 px-3 py-1.5 text-[11px] font-extrabold text-catcha-chocolate">
              ดูรายละเอียด
              <Icon name="chevron" size={12} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function DetailSheet({
  item,
  lineUrl,
  onClose,
}: {
  item: PublicOfferItem;
  lineUrl: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-catcha-chocolate/40 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={plain(item.title)}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-md animate-pop flex-col overflow-hidden rounded-t-catcha bg-card shadow-catcha-sm sm:rounded-catcha"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-catcha-line px-4 py-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-brown-soft">
            Details
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-catcha-chocolate"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {item.imageUrl && (
            <div className="bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.imageUrl}
                alt=""
                className={`mx-auto w-full object-contain ${item.options && item.options.length > 1 ? "max-h-[30dvh]" : "max-h-[46dvh]"}`}
              />
            </div>
          )}
          <div className="p-5">
            <p className="text-base font-extrabold leading-snug text-catcha-chocolate">
              {item.title}
            </p>
            {item.chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.chips.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-sage/20 px-2 py-0.5 text-[11px] font-bold text-ok"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
            {item.note && (
              <p className="mt-2 text-xs font-bold text-latte-deep">
                {item.note}
              </p>
            )}
            {item.options && item.options.length > 1 && (
              <div className="mt-4 overflow-hidden rounded-catcha-sm border border-catcha-line">
                <p className="bg-paper px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-brown-soft">
                  ราคาแต่ละห้อง
                </p>
                <ul className="divide-y divide-catcha-line">
                  {item.options.map((o) => (
                    <li
                      key={o.label}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-extrabold text-catcha-chocolate">
                          {o.label}
                        </p>
                        {o.sub && (
                          <p className="text-[11px] text-brown-soft">{o.sub}</p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-extrabold text-latte-deep">
                        {o.price.toLocaleString()}
                        <span className="text-[11px] font-bold text-brown-faint">
                          {" "}
                          บาท
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {item.body && (
              <p className="mt-4 whitespace-pre-line text-[13px] leading-relaxed text-brown">
                {formatDetail(item.body)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-catcha-line px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <PriceTag item={item} size="lg" />
          <a
            href={lineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-catcha-sm bg-latte-deep px-5 text-sm font-extrabold text-card shadow-catcha-sm"
          >
            <Icon name="message" size={16} />
            ทัก LINE สั่งซื้อ
          </a>
        </div>
      </div>
    </div>
  );
}

export default function PublicOfferCards({
  items,
  lineUrl,
}: {
  items: PublicOfferItem[];
  lineUrl: string;
}) {
  const [open, setOpen] = useState<PublicOfferItem | null>(null);
  return (
    <>
      {/* มือถือ: เลื่อนซ้าย-ขวา · จอใหญ่: ตาราง 3 คอลัมน์ */}
      <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <div
            key={it.id}
            className={`shrink-0 snap-start sm:w-auto sm:max-w-none ${
              items.length > 1 ? "w-[72%] max-w-[280px]" : "w-full"
            }`}
          >
            <OfferCard item={it} onOpen={() => setOpen(it)} />
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <p className="mt-1 text-center text-[11px] text-brown-faint sm:hidden">
          เลื่อนดูทั้งหมด {items.length} รายการ →
        </p>
      )}
      {open && (
        <DetailSheet
          item={open}
          lineUrl={lineUrl}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
