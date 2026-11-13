import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isMarketingSite } from "@/lib/site-mode";
import Image from "next/image";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { getSiteConfig } from "@/lib/config-store";
import SiteFooter from "@/components/SiteFooter";
import MapEmbed from "@/components/MapEmbed";
import { getAppUrl } from "@/lib/app-url";
import { localBusinessNode, breadcrumbNode, faqNode, SHOP_ADDRESS } from "@/lib/seo-schema";

/** หน้าประจำโซนบางพลี (Local SEO) — ร้านตั้งอยู่ในอำเภอบางพลีจริง (ที่อยู่ตาม Google Maps) */

export const revalidate = 300;

const SITE_URL = getAppUrl();
const PHONE_MAIN = BUSINESS.phones[0];
const LINE_URL = "https://line.me/R/ti/p/@catchahotel";
const PATH = "/cat-hotel-bangphli";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "โรงแรมแมว บางพลี รับฝากแมว ใกล้สุวรรณภูมิ เมกาบางนา | CatCha Hotel",
  description:
    "โรงแรมแมวในอำเภอบางพลี สมุทรปราการ ร้านอยู่บางแก้ว ถนนเลียบคลองหลวงแพ่ง ใกล้เมกาบางนา กิ่งแก้ว สนามบินสุวรรณภูมิ ห้องแอร์ส่วนตัว CCTV รายงานทาง LINE เช้า-เย็น เริ่มคืนละ 350.-",
  keywords: [
    "โรงแรมแมว บางพลี",
    "รับฝากแมว บางพลี",
    "ฝากแมว บางพลี",
    "โรงแรมแมว บางแก้ว",
    "ฝากแมว ใกล้สุวรรณภูมิ",
    "โรงแรมแมว กิ่งแก้ว",
    "โรงแรมแมว สมุทรปราการ",
  ],
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: `${SITE_URL}${PATH}`,
    siteName: "CatCha Hotel",
    title: "โรงแรมแมว บางพลี | CatCha Hotel เริ่ม 350.-/คืน",
    description: "ร้านอยู่บางพลีจริง ใกล้เมกาบางนา สุวรรณภูมิ ห้องแอร์ CCTV รายงานทุกวัน",
    images: [{ url: "/catalog/rooms/cat-hotel-bangna-cozy-duo.jpg", width: 800, height: 800, alt: "โรงแรมแมว บางพลี CatCha Hotel" }],
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    q: "โรงแรมแมว CatCha อยู่ตรงไหนของบางพลี?",
    a: `ร้านอยู่ที่ ${SHOP_ADDRESS.full} ย่านหนามแดง–เทพารักษ์ มีที่จอดรถหน้าร้าน กดนำทางจาก Google Maps ได้เลย หรือทักไลน์ขอพิกัดก่อนเข้ามาก็ได้ค่ะ`,
  },
  {
    q: "จะบินจากสุวรรณภูมิ ฝากแมวที่นี่สะดวกไหม?",
    a: "สะดวกค่ะ ร้านอยู่ฝั่งบางพลีเหมือนสนามบิน แวะส่งน้องก่อนขึ้นเครื่องแล้วไปต่อได้เลย กลับมาก็รับน้องได้ในเวลาเปิด 09:00–19:00 หรือใช้บริการรับ-ส่งถึงบ้าน",
  },
  {
    q: "ราคาฝากแมวเท่าไหร่?",
    a: "ห้องเริ่มต้นคืนละ 350 บาท มีห้องใหญ่และห้องเชื่อมสำหรับบ้านที่มีแมวหลายตัว ทุกห้องเป็นห้องแอร์ พัก 3 คืนขึ้นไปมีทรายแมวฟรี",
  },
  {
    q: "มีรับ-ส่งน้องในบางพลีไหม?",
    a: "มีค่ะ รับ-ส่งถึงบ้านทั่วบางพลี บางแก้ว กิ่งแก้ว บางนา เทพารักษ์ คิดตามระยะทาง แจ้งพิกัดทางไลน์เพื่อเช็กราคาค่ะ",
  },
];

function jsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [localBusinessNode(), breadcrumbNode("โรงแรมแมว บางพลี", PATH), faqNode(FAQS)],
  };
}

export default async function CatHotelBangphliPage() {
  if (!isMarketingSite()) redirect("/app");
  const config = await getSiteConfig();
  const rooms = config.rooms.slice(0, 3);
  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd()) }} />
      <Link href="/" className="text-xs font-bold text-brown-soft">
        ← หน้าแรก CatCha Hotel
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-snug text-catcha-chocolate md:text-3xl">
        โรงแรมแมว บางพลี
        <span className="block text-lg text-latte-deep md:text-xl">
          รับฝากแมว ใกล้เมกาบางนา · กิ่งแก้ว · สุวรรณภูมิ
        </span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-brown-soft">
        CatCha Hotel ตั้งอยู่ใน<b className="text-catcha-chocolate">อำเภอบางพลี</b> ที่{" "}
        {SHOP_ADDRESS.full} คนบางพลี บางแก้ว กิ่งแก้ว และหมู่บ้านแถวเมกาบางนา ขับมาไม่ไกล
        ทุกห้องเป็นห้องแอร์ส่วนตัว มี CCTV ให้เจ้าของดูน้องได้ พี่เลี้ยงทำความสะอาดทุกวัน
        พาเล่นวันละ 2 รอบ และส่งรูปพร้อมรายงานทาง LINE เช้า-เย็นทุกวัน
      </p>

      <h2 className="mt-8 text-lg font-extrabold text-catcha-chocolate">✈️ ฝากแมวก่อนบิน สุวรรณภูมิ</h2>
      <p className="mt-2 text-sm leading-relaxed text-brown-soft">
        ร้านอยู่ฝั่งเดียวกับสนามบิน แวะส่งน้องแล้วไปขึ้นเครื่องต่อได้เลย ไม่ต้องย้อนเข้าเมือง
        อ่านเช็กลิสต์ก่อนบินได้ที่{" "}
        <Link href="/blog" className="font-bold text-latte-deep underline">
          บทความของเรา
        </Link>
      </p>

      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">ห้องพักแมว</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {rooms.map((r) => (
          <Link
            key={r.id}
            href="/cat-hotel"
            className="overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm transition hover:-translate-y-0.5"
          >
            <Image
              src={r.image}
              alt={`โรงแรมแมว บางพลี ห้อง ${r.name}`}
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

      <MapEmbed title="📍 แผนที่ร้าน บางพลี" />

      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">❓ คำถามจากลูกค้าบางพลี</h2>
      <div className="mt-3 space-y-3">
        {FAQS.map((f, i) => (
          <div key={i} className="rounded-catcha border border-catcha-line bg-card p-4">
            <p className="text-sm font-extrabold text-catcha-chocolate">{f.q}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-brown-soft">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-catcha bg-gradient-to-br from-honey/35 via-card to-latte/15 p-6 text-center shadow-catcha">
        <h2 className="text-lg font-extrabold text-catcha-chocolate">คนบางพลี ทักมาเลย 🧡</h2>
        <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={LINE_URL} className="rounded-catcha-sm bg-[#06C755] px-6 py-3.5 text-sm font-extrabold text-white shadow-catcha-sm">
            💬 LINE @catchahotel
          </a>
          <a
            href={`tel:${PHONE_MAIN.replace(/-/g, "")}`}
            className="rounded-catcha-sm bg-latte-deep px-6 py-3.5 text-sm font-extrabold text-white shadow-catcha-sm"
          >
            📞 {PHONE_MAIN}
          </a>
        </div>
        <p className="mt-4 text-[11px]">
          <Link href="/cat-bath-bangphli" className="font-bold text-latte-deep underline">
            🛁 อาบน้ำแมว บางพลี ดูเมนู-ราคา →
          </Link>
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
