import { BUSINESS } from "@/lib/business";
import { SHOP_ADDRESS } from "@/lib/seo-schema";

/**
 * แผนที่ Google ฝังในหน้าเว็บ (โหลดเมื่อเลื่อนถึง) + ที่อยู่เต็ม + ปุ่มนำทาง
 * ช่วยลูกค้าหาร้านเจอ และช่วย Google ผูกเว็บกับหมุดร้านใน Maps
 */
export default function MapEmbed({ title = "📍 แผนที่ร้าน CatCha Hotel" }: { title?: string }) {
  return (
    <section className="mt-10 overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
      <div className="p-4 text-center">
        <h2 className="text-lg font-extrabold text-catcha-chocolate">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-brown-soft">{SHOP_ADDRESS.full}</p>
        <p className="text-xs text-brown-soft">เปิดทุกวัน 09:00–19:00 · มีที่จอดรถหน้าร้าน</p>
      </div>
      <iframe
        title="แผนที่ CatCha Hotel โรงแรมแมว อาบน้ำแมว"
        src="https://www.google.com/maps?q=13.6290175,100.654973&z=16&hl=th&output=embed"
        className="block h-64 w-full border-0 md:h-80"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <div className="p-4 text-center">
        <a
          href={BUSINESS.maps}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-catcha-sm bg-honey/40 px-6 py-3 text-sm font-extrabold text-catcha-chocolate"
        >
          🗺️ นำทางด้วย Google Maps
        </a>
      </div>
    </section>
  );
}
