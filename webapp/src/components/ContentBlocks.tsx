import Image from "next/image";
import type { BoardingRuleBlock } from "@/lib/config-types";
import { posterFor } from "@/lib/en-posters";

/**
 * เรนเดอร์บล็อกเนื้อหา (รูป/ข้อความ) ที่ร้านเพิ่มเองในหลังบ้าน — ใช้ร่วมกันทั้งหน้า SEO
 * สาธารณะและหน้าในแอปลูกค้า ไม่มี hook จึงเรียกจาก server component ได้ด้วย
 */
export function ContentBlocks({ blocks, locale }: { blocks?: BoardingRuleBlock[]; locale?: string }) {
  if (!blocks || blocks.length === 0) return null;
  const en = locale === "en";
  return (
    <div className="mt-6 space-y-4">
      {blocks.map((b) => {
        // ลูกค้าภาษาอังกฤษ: ใช้รูป/ข้อความอังกฤษที่ร้านตั้ง — ไม่ได้ตั้งก็ใช้ของไทย (รูปไทยที่มีคู่อังกฤษจะแปลงให้)
        const image = en ? posterFor(b.image || "", "en", b.imageEn) : b.image;
        const text = en && b.textEn?.trim() ? b.textEn : b.text;
        return (
        <div
          key={b.id}
          className="rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm"
        >
          {image && (
            <Image
              src={image}
              alt=""
              width={800}
              height={500}
              sizes="(max-width: 640px) 100vw, 600px"
              className="mb-3 h-auto w-full rounded-catcha-sm object-cover"
              unoptimized
            />
          )}
          {text && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-brown">{text}</p>
          )}
        </div>
        );
      })}
    </div>
  );
}
