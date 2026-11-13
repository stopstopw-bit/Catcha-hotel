import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isMarketingSite } from "@/lib/site-mode";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { getSiteConfig } from "@/lib/config-store";
import { resolveGroomPrograms, type GroomProgram } from "@/lib/grooming-prices";
import SiteFooter from "@/components/SiteFooter";
import MapEmbed from "@/components/MapEmbed";
import { getAppUrl } from "@/lib/app-url";
import { BUSINESS_ID, localBusinessNode, breadcrumbNode, faqNode, SHOP_ADDRESS } from "@/lib/seo-schema";

/** หน้าอาบน้ำแมว บางพลี (Local SEO) — ราคาดึงจากตารางในหลังบ้าน */

export const revalidate = 300;

const SITE_URL = getAppUrl();
const PHONE_MAIN = BUSINESS.phones[0];
const LINE_URL = "https://line.me/R/ti/p/@catchahotel";
const PATH = "/cat-bath-bangphli";

function cheapestPrice(prog: GroomProgram | undefined, fallback: number): number {
  if (!prog) return fallback;
  const all = prog.breeds.flatMap((b) => Object.values(b.prices));
  return all.length ? Math.min(...all) : fallback;
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "อาบน้ำแมว บางพลี อาบแบบ Private เริ่ม 400.- | CatCha Hotel",
  description:
    "ร้านอาบน้ำแมวในอำเภอบางพลี สมุทรปราการ อาบแบบ Private รับทีละบ้าน เป่าแห้งสนิท รวมตัดเล็บ เช็ดหู มีโปรแกรมขจัดคราบมัน ยับยั้งเชื้อรา Malaseb ใกล้บางแก้ว กิ่งแก้ว เมกาบางนา",
  keywords: ["อาบน้ำแมว บางพลี", "ร้านอาบน้ำแมว บางพลี", "อาบน้ำแมว บางแก้ว", "อาบน้ำแมว กิ่งแก้ว", "อาบน้ำแมว ใกล้ฉัน"],
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: `${SITE_URL}${PATH}`,
    siteName: "CatCha Hotel",
    title: "อาบน้ำแมว บางพลี | CatCha Hotel เริ่ม 400.-",
    description: "อาบแบบ Private รับทีละบ้าน พี่เลี้ยงใจเย็นกับแมวขี้กลัว",
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    q: "ร้านอาบน้ำแมวอยู่ตรงไหนของบางพลี?",
    a: `ร้านอยู่ที่ ${SHOP_ADDRESS.full} มีที่จอดรถหน้าร้าน เปิดทุกวัน 09:00–19:00`,
  },
  {
    q: "แมวขี้กลัว อาบได้ไหม?",
    a: "ได้ค่ะ อาบแบบ Private รับทีละบ้าน ไม่ปะปนกับแมวตัวอื่น พี่เลี้ยงใจเย็น ค่อยๆ ให้น้องปรับตัวก่อนอาบ",
  },
  {
    q: "มีบริการตัดขนไหม?",
    a: "ทางร้านไม่มีบริการตัดขนค่ะ มีอาบน้ำ-เป่าขน ขจัดคราบมัน ยับยั้งเชื้อรา (Malaseb) และ Catcha Premium สำหรับแมวขนยาว",
  },
  {
    q: "มีรับ-ส่งน้องไหม?",
    a: "มีค่ะ รับ-ส่งถึงบ้านทั่วบางพลี บางแก้ว กิ่งแก้ว คิดตามระยะทาง ทักไลน์แจ้งพิกัดได้เลย",
  },
];

export default async function CatBathBangphliPage() {
  if (!isMarketingSite()) redirect("/app");
  const config = await getSiteConfig();
  const programs = resolveGroomPrograms(config.groomPricePrograms);
  const rows = programs.map((p) => ({ name: p.name, from: cheapestPrice(p, 0) })).filter((r) => r.from > 0);
  const bathFrom = rows.length ? Math.min(...rows.map((r) => r.from)) : 400;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "อาบน้ำแมว บางพลี — CatCha Hotel",
        serviceType: "Cat bathing & grooming spa",
        url: `${SITE_URL}${PATH}`,
        provider: { "@id": BUSINESS_ID },
        areaServed: ["บางพลี", "บางแก้ว", "กิ่งแก้ว", "เทพารักษ์", "หนามแดง", "บางนา", "สมุทรปราการ"],
        offers: rows.map((r) => ({ "@type": "Offer", name: r.name, price: String(r.from), priceCurrency: "THB" })),
      },
      localBusinessNode(),
      breadcrumbNode("อาบน้ำแมว บางพลี", PATH),
      faqNode(FAQS),
    ],
  };

  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Link href="/" className="text-xs font-bold text-brown-soft">
        ← หน้าแรก CatCha Hotel
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-snug text-catcha-chocolate md:text-3xl">
        อาบน้ำแมว บางพลี
        <span className="block text-lg text-latte-deep md:text-xl">อาบแบบ Private รับทีละบ้าน เริ่ม {bathFrom}.-</span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-brown-soft">
        ร้านอาบน้ำแมวใน<b className="text-catcha-chocolate">อำเภอบางพลี</b> ใกล้บางแก้ว กิ่งแก้ว และเมกาบางนา
        อาบทีละบ้าน ไม่ปะปนกับแมวตัวอื่น เป่าแห้งสนิทถึงขนชั้นใน รวมตัดเล็บและเช็ดหูทุกโปรแกรม
        (ทางร้านไม่มีบริการตัดขน)
      </p>

      <h2 className="mt-8 text-lg font-extrabold text-catcha-chocolate">🛁 เมนูอาบน้ำ (ราคาเริ่มต้น)</h2>
      <div className="mt-3 divide-y divide-catcha-line rounded-catcha border border-catcha-line bg-card">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="font-bold text-catcha-chocolate">{r.name}</span>
            <span className="font-extrabold text-latte-deep">เริ่ม {r.from.toLocaleString()}.-</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-brown-soft">
        ราคาตามพันธุ์และน้ำหนัก ·{" "}
        <Link href="/cat-bath" className="font-bold text-latte-deep underline">
          ดูตารางราคาเต็ม →
        </Link>
      </p>

      <MapEmbed title="📍 แผนที่ร้าน บางพลี" />

      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">❓ คำถามที่พบบ่อย</h2>
      <div className="mt-3 space-y-3">
        {FAQS.map((f, i) => (
          <div key={i} className="rounded-catcha border border-catcha-line bg-card p-4">
            <p className="text-sm font-extrabold text-catcha-chocolate">{f.q}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-brown-soft">{f.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-catcha bg-gradient-to-br from-honey/35 via-card to-latte/15 p-6 text-center shadow-catcha">
        <h2 className="text-lg font-extrabold text-catcha-chocolate">จองคิวอาบน้ำ ทักมาเลย 🧡</h2>
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
          <Link href="/cat-hotel-bangphli" className="font-bold text-latte-deep underline">
            🏨 ฝากแมวค้างคืน บางพลี →
          </Link>
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
