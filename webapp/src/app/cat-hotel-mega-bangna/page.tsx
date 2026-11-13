import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isMarketingSite } from "@/lib/site-mode";
import Image from "next/image";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { getSiteConfig } from "@/lib/config-store";
import SiteFooter from "@/components/SiteFooter";

/**
 * หน้าประจำโซน: โรงแรมแมว ใกล้เมกาบางนา (Local SEO area page)
 * คนค้นทั้ง "เมกาบางนา" (ชื่อทางการ) และ "เมกะบางนา" (สะกดตามเสียง) — หน้านี้ใส่ทั้งสองแบบ
 * เนื้อหาเน้นคนที่มาห้าง/อิเกีย/ไปสุวรรณภูมิ ไม่ซ้ำหน้า /cat-hotel-bangna (เน้นถนนบางนา-อุดมสุข-แบริ่ง)
 */

import { getAppUrl } from "@/lib/app-url";
import { localBusinessNode, breadcrumbNode, faqNode } from "@/lib/seo-schema";

// ราคา/รูปห้องมาจากหลังบ้าน — ดึงค่าล่าสุดทุก 5 นาที
export const revalidate = 300;

const SITE_URL = getAppUrl();
const PATH = "/cat-hotel-mega-bangna";
const PHONE_MAIN = BUSINESS.phones[0];
const LINE_URL = "https://line.me/R/ti/p/@catchahotel";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "โรงแรมแมว เมกาบางนา (เมกะบางนา) ห่างห้าง ~10 นาที เริ่ม 350.-/คืน | CatCha Hotel",
  description:
    "โรงแรมแมวใกล้เมกาบางนา (เมกะบางนา) อิเกียบางนา — CatCha Hotel ขับจากห้างแค่ ~10 นาทีทางเทพารักษ์ ห้องแอร์ส่วนตัว CCTV ดูน้องได้ รายงานเช้า-เย็นทาง LINE อาบน้ำแมวแล้วไปเดินห้างรอได้ เริ่มคืนละ 350.-",
  keywords: [
    "โรงแรมแมว เมกาบางนา",
    "โรงแรมแมว เมกะบางนา",
    "ฝากแมว เมกาบางนา",
    "ฝากแมว เมกะบางนา",
    "รับฝากแมว ใกล้เมกาบางนา",
    "อาบน้ำแมว เมกาบางนา",
    "อาบน้ำแมว เมกะบางนา",
    "โรงแรมแมว ใกล้สุวรรณภูมิ",
  ],
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: `${SITE_URL}${PATH}`,
    siteName: "CatCha Hotel",
    title: "โรงแรมแมว ใกล้เมกาบางนา | CatCha Hotel เริ่ม 350.-/คืน",
    description: "ขับจากเมกาบางนา ~10 นาที ห้องแอร์ CCTV รายงานทุกวัน อาบน้ำแมวแล้วไปเดินห้างรอได้",
    images: [{ url: "/catalog/rooms/cat-hotel-bangna-mid-cozy.jpg", width: 800, height: 800, alt: "โรงแรมแมวใกล้เมกาบางนา CatCha Hotel" }],
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    q: "จากเมกาบางนา (เมกะบางนา) ไปร้านกี่นาที?",
    a: "ประมาณ 10 นาทีค่ะ ออกจากห้างใช้ถนนเทพารักษ์มุ่งหน้าหนามแดง ร้านอยู่ในหมู่บ้านย่านหนามแดง มีที่จอดรถหน้าร้าน กดเปิด Google Maps จากหน้านี้นำทางได้เลย",
  },
  {
    q: "พาน้องมาอาบน้ำ แล้วไปเดินเมกาบางนารอได้ไหม?",
    a: "ได้ค่ะ ลูกค้าหลายบ้านทำแบบนี้ อาบน้ำ-เป่าแห้งใช้เวลาประมาณ 1.5–2.5 ชั่วโมงตามขนาดตัวและสภาพขน พอเสร็จพี่เลี้ยงส่งรูปแจ้งทาง LINE แล้วค่อยขับกลับมารับน้อง (ทางร้านไม่มีบริการตัดขนนะคะ)",
  },
  {
    q: "จะบินจากสุวรรณภูมิ ฝากแมวก่อนไปสนามบินทันไหม?",
    a: "ทันค่ะ ร้านอยู่ฝั่งตะวันออกของกรุงเทพฯ ทางเดียวกับสนามบิน เช็กอินได้ 09:00–18:00 ถ้าไฟลต์เช้ามืดแนะนำพาน้องมาเช็กอินเย็นวันก่อน ร้านเปิดทุกวัน 09:00–19:00",
  },
  {
    q: "อยู่คอนโดแถวเมกาบางนา ไม่มีรถ ทำยังไงดี?",
    a: "มีบริการรับ-ส่งน้องแมวถึงบ้านด้วยรถยนต์ส่วนตัว คิดตามระยะทาง แจ้งพิกัดคอนโดทางไลน์เพื่อเช็กราคาได้เลยค่ะ",
  },
];

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      localBusinessNode(),
      breadcrumbNode("โรงแรมแมว เมกาบางนา", PATH),
      faqNode(FAQS),
    ],
  };
}

export default async function CatHotelMegaBangnaPage() {
  if (!isMarketingSite()) redirect("/app");
  const config = await getSiteConfig();
  const topRooms = config.rooms.filter((r) => r.count).slice(0, 3);
  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }}
      />
      <Link href="/" className="text-xs font-bold text-brown-soft">
        ← หน้าแรก CatCha Hotel
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-snug text-catcha-chocolate md:text-3xl">
        โรงแรมแมว ใกล้เมกาบางนา
        <span className="block text-lg text-latte-deep md:text-xl">
          (เมกะบางนา) ขับจากห้างแค่ ~10 นาที เริ่มคืนละ 350.-
        </span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-brown-soft">
        ทาสแมวที่อยู่<b className="text-catcha-chocolate">คอนโด-หมู่บ้านรอบเมกาบางนา อิเกียบางนา</b>{" "}
        หรือแวะห้างเป็นประจำ — CatCha Hotel อยู่บางแก้ว 9 ถนนเลียบคลองหลวงแพ่ง ย่านหนามแดง–เทพารักษ์ ขับจากห้างประมาณ 10 นาที
        ทุกห้องเป็นห้องแอร์ส่วนตัว มี CCTV ให้เปิดดูน้อง พี่เลี้ยงส่งรูป-วิดีโอรายงานเช้า-เย็นทุกวันทาง LINE
        และมี<b className="text-catcha-chocolate">บริการอาบน้ำแมว</b>ที่ร้านเดียวกัน
      </p>

      <h2 className="mt-8 text-lg font-extrabold text-catcha-chocolate">
        🛍️ คนแถวเมกาบางนาใช้บริการแบบไหนบ้าง
      </h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-brown">
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>
            <b>อาบน้ำแล้วไปเดินห้างรอ</b> — ส่งน้องตอนสาย ไปกินข้าว-ช้อปปิ้งที่เมกาบางนา
            พี่เลี้ยงทักไลน์เมื่อน้องพร้อมกลับบ้าน
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>
            <b>ฝากก่อนบินจากสุวรรณภูมิ</b> — ร้านอยู่ทางเดียวกับสนามบิน ส่งน้องเสร็จไปต่อได้เลย
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>
            <b>ฝากระหว่างรีโนเวตห้อง/ย้ายคอนโด</b> — รับทั้งรายวันและรายเดือน
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>
            <b>ไม่มีรถ?</b> มีรถรับ-ส่งน้องถึงหน้าคอนโด คิดตามระยะทาง
          </span>
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-extrabold text-catcha-chocolate">🚗 เดินทางจากเมกาบางนา</h2>
      <p className="mt-2 text-sm leading-relaxed text-brown">
        ออกจากห้างใช้<b>ถนนเทพารักษ์</b> มุ่งหน้าหนามแดง ประมาณ 10 นาที ร้านอยู่ในหมู่บ้าน
        มีที่จอดรถหน้าร้าน เปิดทุกวัน 09:00–19:00 (เช็กอิน 09:00–18:00)
      </p>
      <a
        href={BUSINESS.maps}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block rounded-catcha-sm border-2 border-latte-deep bg-card px-5 py-2.5 text-sm font-extrabold text-latte-deep shadow-catcha-sm"
      >
        🗺️ เปิด Google Maps นำทางเลย
      </a>

      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">ห้องพักแมว ราคาเริ่มต้น</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {topRooms.map((r) => (
          <Link
            key={r.id}
            href="/cat-hotel"
            className="overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm transition hover:-translate-y-0.5"
          >
            <Image
              src={r.image}
              alt={`โรงแรมแมวใกล้เมกาบางนา ห้อง ${r.name}`}
              width={600}
              height={600}
              sizes="(max-width: 640px) 100vw, 33vw"
              className="h-auto w-full"
            />
            <div className="p-3 text-center">
              <p className="text-sm font-extrabold text-catcha-chocolate">{r.name}</p>
              <p className="text-xs font-bold text-latte-deep">{r.price.toLocaleString()} บาท/คืน</p>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-center text-xs">
        <Link href="/cat-hotel" className="font-bold text-latte-deep underline">
          ดูห้องพักทั้งหมด + รูปจริงทุกห้อง →
        </Link>
      </p>

      {config.transport.th.length > 0 && (
        <>
      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">🚚 ค่ารับ-ส่งน้องแมว</h2>
      <ul className="mt-3 space-y-1 text-sm text-brown">
        {config.transport.th.map((t) => (
          <li key={t}>• {t}</li>
        ))}
      </ul>
        </>
      )}

      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">
        ❓ คำถามจากลูกค้าแถวเมกาบางนา
      </h2>
      <div className="mt-3 space-y-3">
        {FAQS.map((f, i) => (
          <div key={i} className="rounded-catcha border border-catcha-line bg-card p-4">
            <p className="text-sm font-extrabold text-catcha-chocolate">{f.q}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-brown-soft">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-catcha bg-gradient-to-br from-honey/35 via-card to-latte/15 p-6 text-center shadow-catcha">
        <h2 className="text-lg font-extrabold text-catcha-chocolate">เช็กห้องว่าง / คิวอาบน้ำ 🧡</h2>
        <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={LINE_URL}
            className="rounded-catcha-sm bg-[#06C755] px-6 py-3.5 text-sm font-extrabold text-white shadow-catcha-sm"
          >
            💬 LINE @catchahotel
          </a>
          <a
            href={`tel:${PHONE_MAIN.replace(/-/g, "")}`}
            className="rounded-catcha-sm bg-latte-deep px-6 py-3.5 text-sm font-extrabold text-white shadow-catcha-sm"
          >
            📞 {PHONE_MAIN}
          </a>
        </div>
        <p className="mt-4 flex flex-col gap-1 text-[11px]">
          <Link href="/cat-bath" className="font-bold text-latte-deep underline">
            🛁 ดูเมนู-ราคาอาบน้ำแมว →
          </Link>
          <Link href="/cat-hotel-bangna" className="font-bold text-latte-deep underline">
            🏨 โรงแรมแมวโซนบางนา อุดมสุข แบริ่ง →
          </Link>
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
