import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isMarketingSite } from "@/lib/site-mode";
import Image from "next/image";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { getSiteConfig } from "@/lib/config-store";
import { resolveGroomPrograms, groomProgram, type GroomProgram } from "@/lib/grooming-prices";
import SiteFooter from "@/components/SiteFooter";

/** หน้าประจำโซน: อาบน้ำแมว เทพารักษ์–หนามแดง–สมุทรปราการ (โซนบ้านของร้าน · Local SEO area page) · ร้านไม่มีบริการตัดขน */

import { getAppUrl } from "@/lib/app-url";
import { BUSINESS_ID, localBusinessNode, breadcrumbNode, faqNode } from "@/lib/seo-schema";

// ราคาอาบน้ำมาจากหลังบ้านแล้ว — ตั้ง revalidate ให้ดึงค่าล่าสุดทุก 5 นาที
export const revalidate = 300;

const SITE_URL = getAppUrl();

/** ต่ำสุดของราคาในโปรแกรม — ใช้โชว์เป็นราคา "เริ่มต้น" (ไม่เจอโปรแกรมคืน fallback ที่ส่งมา) */
function cheapestPrice(prog: GroomProgram | undefined, fallback: number): number {
  if (!prog) return fallback;
  const all = prog.breeds.flatMap((b) => Object.values(b.prices));
  return all.length ? Math.min(...all) : fallback;
}
const PHONE_MAIN = BUSINESS.phones[0];
const LINE_URL = "https://line.me/R/ti/p/@catchahotel";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "อาบน้ำแมว เทพารักษ์ หนามแดง สมุทรปราการ ร้านใกล้บ้าน รับทีละบ้าน | CatCha Hotel",
  description:
    "ร้านอาบน้ำแมวในย่านเทพารักษ์–หนามแดง สมุทรปราการ ใกล้สำโรง บางพลี ปากน้ำ — CatCha Hotel อาบแบบ Private รับน้องทีละบ้าน แชมพูพรีเมียม เป่าแห้งถึงชั้นใน รวมตัดเล็บ เช็ดหู มีรถรับ-ส่งน้องถึงบ้าน เริ่ม 400.-",
  keywords: [
    "อาบน้ำแมว เทพารักษ์",
    "อาบน้ำแมว หนามแดง",
    "อาบน้ำแมว สมุทรปราการ",
    "อาบน้ำแมว สำโรง",
    "อาบน้ำแมว บางพลี",
    "อาบน้ำแมว ปากน้ำ",
    "ร้านอาบน้ำแมว ใกล้ฉัน",
    "อาบน้ำแมว รับส่งถึงบ้าน",
  ],
  alternates: { canonical: "/cat-bath-samutprakan" },
  openGraph: {
    type: "website",
    locale: "th_TH",
    url: `${SITE_URL}/cat-bath-samutprakan`,
    siteName: "CatCha Hotel",
    title: "อาบน้ำแมว เทพารักษ์–หนามแดง สมุทรปราการ | CatCha Hotel เริ่ม 400.-",
    description: "ร้านอยู่ในย่านเทพารักษ์ อาบแบบ Private รับทีละบ้าน มีรถรับ-ส่งน้อง",
    images: [{ url: "/catalog/grooming/grooming-menu.jpg", width: 853, height: 1280, alt: "อาบน้ำแมว เทพารักษ์ สมุทรปราการ CatCha Hotel" }],
  },
  robots: { index: true, follow: true },
};

const FAQS = [
  {
    q: "ร้านอาบน้ำแมวอยู่ตรงไหนของเทพารักษ์?",
    a: "ร้านอยู่ในบางแก้ว 9 ถนนเลียบคลองหลวงแพ่ง ย่านหนามแดง–เทพารักษ์ สมุทรปราการ มีที่จอดรถหน้าร้าน จากสำโรง ปากน้ำ หรือบางพลี มาถึงได้ไม่ไกล แจ้งพิกัดละเอียดทางไลน์ก่อนเข้ามาได้เลยค่ะ",
  },
  {
    q: "ไม่สะดวกพาน้องมาเอง มีรับ-ส่งไหม?",
    a: "มีค่ะ รถรับ-ส่งน้องแมวถึงบ้านทั่วโซนเทพารักษ์ หนามแดง สำโรง บางพลี บางแก้ว คิดตามระยะทาง เพราะร้านอยู่โซนเดียวกันค่ารถจึงไม่แพง อาบเสร็จส่งน้องกลับถึงบ้านได้เลยค่ะ",
  },
  {
    q: "แมวเป็นเชื้อรา/ขนมัน อาบที่นี่ได้ไหม?",
    a: "ได้ค่ะ มีโปรแกรมอาบน้ำขจัดคราบมัน และโปรแกรมอาบยับยั้งเชื้อรา (Malaseb) ถ้าน้องกำลังรักษากับคุณหมออยู่ แนะนำแจ้งพี่เลี้ยงก่อนวันนัด และเป่าแห้งสนิทถึงขนชั้นในทุกตัวเพื่อไม่ให้เชื้อราลามค่ะ",
  },
  {
    q: "อาบน้ำแล้วฝากค้างต่อได้ไหม?",
    a: "ได้ค่ะ ร้านเป็นโรงแรมแมวด้วย จะอาบก่อนกลับบ้านหลังฝาก หรืออาบแล้วเข้าพักต่อก็ได้ จบในที่เดียว ไม่ต้องพาน้องไปหลายร้าน (ทางร้านไม่มีบริการตัดขนนะคะ)",
  },
];

function jsonLd(bath?: GroomProgram, degrease?: GroomProgram) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        name: "อาบน้ำแมว เทพารักษ์ หนามแดง สมุทรปราการ — CatCha Hotel",
        serviceType: "Cat bathing & grooming spa",
        url: `${SITE_URL}/cat-bath-samutprakan`,
        provider: { "@id": BUSINESS_ID },
        areaServed: ["เทพารักษ์", "หนามแดง", "สำโรง", "บางพลี", "ปากน้ำ", "บางแก้ว", "สมุทรปราการ"],
        offers: [
          { "@type": "Offer", name: bath?.name || "อาบน้ำ-เป่าขน", price: String(cheapestPrice(bath, 400)), priceCurrency: "THB" },
          { "@type": "Offer", name: degrease?.name || "อาบน้ำ+ขจัดคราบมัน", price: String(cheapestPrice(degrease, 500)), priceCurrency: "THB" },
        ],
      },
      localBusinessNode(),
      breadcrumbNode("อาบน้ำแมว เทพารักษ์ สมุทรปราการ", "/cat-bath-samutprakan"),
      faqNode(FAQS),
    ],
  };
}

export default async function CatBathSamutprakanPage() {
  if (!isMarketingSite()) redirect("/app");
  const config = await getSiteConfig();
  const programs = resolveGroomPrograms(config.groomPricePrograms);
  const bath = groomProgram("bath-dry", programs);
  const degrease = groomProgram("bath-degrease", programs);
  const premium = groomProgram("premium", programs);
  const malaseb = groomProgram("malaseb", programs);
  const advancePrices = [premium, malaseb]
    .map((p) => cheapestPrice(p, 0))
    .filter((n) => n > 0);
  const bathFrom = cheapestPrice(bath, 400);
  const degreaseFrom = cheapestPrice(degrease, 500);
  const advanceFrom = advancePrices.length ? Math.min(...advancePrices) : 700;
  return (
    <main className="mx-auto max-w-3xl px-5 pb-16 pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(bath, degrease)) }}
      />
      <Link href="/" className="text-xs font-bold text-brown-soft">
        ← หน้าแรก CatCha Hotel
      </Link>
      <h1 className="mt-3 text-2xl font-extrabold leading-snug text-catcha-chocolate md:text-3xl">
        อาบน้ำแมว เทพารักษ์ · หนามแดง · สมุทรปราการ
        <span className="block text-lg text-latte-deep md:text-xl">
          ร้านอยู่ในย่านนี้ อาบแบบ Private เริ่ม 400.-
        </span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-brown-soft">
        ทาสแมวโซน<b className="text-catcha-chocolate">เทพารักษ์ หนามแดง สำโรง บางพลี ปากน้ำ</b>{" "}
        ไม่ต้องขับเข้าเมืองไปอาบน้ำน้อง — CatCha Hotel อยู่บางแก้ว 9 ถนนเลียบคลองหลวงแพ่ง ย่านหนามแดง–เทพารักษ์ รับอาบ
        <b className="text-catcha-chocolate">ทีละบ้าน</b> น้องไม่ต้องเจอแมวแปลกหน้า
        ไม่มีเสียงไดร์ดังพร้อมกันหลายตัว เหมาะกับ<b className="text-catcha-chocolate">แมวขี้กลัว
        แมวอาบครั้งแรก</b>เป็นพิเศษ ใช้แชมพูเกรดพรีเมียม เป่าแห้งสนิทถึงขนชั้นใน
        ราคารวมตัดเล็บ เช็ดหู-ตา แล้ว
        <span className="mt-1 block font-bold">หมายเหตุ: ทางร้านไม่มีบริการตัดขนนะคะ 🙏</span>
      </p>

      {/* ข้อดีของร้านใกล้บ้าน */}
      <h2 className="mt-8 text-lg font-extrabold text-catcha-chocolate">
        🏡 อาบน้ำแมวใกล้บ้าน ดีกว่ายังไง
      </h2>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-brown">
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>
            <b>น้องนั่งรถสั้น เครียดน้อย</b> — แมวส่วนใหญ่กลัวการเดินทางมากกว่ากลัวน้ำ ร้านใกล้บ้านช่วยได้เยอะ
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>
            <b>คิว Private รับทีละบ้าน</b> — ไม่มีแมวแปลกหน้า ไม่มีเสียงไดร์หลายตัวพร้อมกัน
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>
            <b>มีรถรับ-ส่งถึงบ้าน</b> — อยู่โซนเดียวกัน ค่ารถไม่แพง ไม่ต้องลางานพาน้องมา
          </span>
        </li>
        <li className="flex gap-2">
          <span className="shrink-0">✓</span>
          <span>
            <b>อาบ + ฝากจบที่เดียว</b> — ไปเที่ยวก็ฝากต่อได้ อาบให้หอมก่อนรับกลับบ้าน
          </span>
        </li>
      </ul>

      {/* ราคา */}
      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">💰 ราคาเริ่มต้น</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {[
          [bath?.name || "อาบน้ำ-เป่าขน", `เริ่ม ${bathFrom.toLocaleString()}.-`, "ตามพันธุ์และขนาดตัว"],
          [degrease?.name || "อาบน้ำ+ขจัดคราบมัน", `เริ่ม ${degreaseFrom.toLocaleString()}.-`, "ขนมันเหนียว เส้นจับตัว"],
          ["Advance (พรีเมียม/เชื้อรา)", `เริ่ม ${advanceFrom.toLocaleString()}.-`, "Catcha Premium / Malaseb"],
        ].map(([name, price, desc]) => (
          <div key={name} className="rounded-catcha border border-catcha-line bg-card p-4 text-center">
            <p className="text-sm font-extrabold text-catcha-chocolate">{name}</p>
            <p className="mt-1 text-lg font-extrabold text-latte-deep">{price}</p>
            <p className="text-[11px] text-brown-soft">{desc}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs">
        <Link href="/cat-bath" className="font-bold text-latte-deep underline">
          ดูตารางราคาเต็มทุกสายพันธุ์ ทุกขนาดตัว →
        </Link>
      </p>

      {/* เมนูรูป */}
      <div className="mx-auto mt-6 max-w-md">
        <a href="/catalog/grooming/grooming-menu.jpg" target="_blank" rel="noopener noreferrer">
          <Image
            src="/catalog/grooming/grooming-menu.jpg"
            alt="เมนูราคาอาบน้ำแมว เทพารักษ์ หนามแดง สมุทรปราการ CatCha Hotel"
            width={853}
            height={1280}
            sizes="(max-width: 640px) 100vw, 448px"
            className="h-auto w-full rounded-catcha border border-catcha-line shadow-catcha-sm"
          />
        </a>
      </div>

      {/* FAQ โซน */}
      <h2 className="mt-10 text-lg font-extrabold text-catcha-chocolate">
        ❓ คำถามจากลูกค้าโซนเทพารักษ์–สมุทรปราการ
      </h2>
      <div className="mt-3 space-y-3">
        {FAQS.map((f, i) => (
          <div key={i} className="rounded-catcha border border-catcha-line bg-card p-4">
            <p className="text-sm font-extrabold text-catcha-chocolate">{f.q}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-brown-soft">{f.a}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-10 rounded-catcha bg-gradient-to-br from-honey/35 via-card to-latte/15 p-6 text-center shadow-catcha">
        <h2 className="text-lg font-extrabold text-catcha-chocolate">จองคิวอาบน้ำ Private 🧡</h2>
        <p className="mt-1 text-xs text-brown-soft">
          แจ้งพันธุ์ + น้ำหนักน้อง เดี๋ยวพี่เลี้ยงแจ้งราคาและคิวว่างทันทีค่ะ
        </p>
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
        <p className="mt-4 text-[11px]">
          <Link href="/cat-hotel-samutprakan" className="font-bold text-latte-deep underline">
            🏨 ฝากแมวโซนเทพารักษ์–สมุทรปราการด้วย? →
          </Link>
        </p>
      </div>

      <SiteFooter />
    </main>
  );
}
