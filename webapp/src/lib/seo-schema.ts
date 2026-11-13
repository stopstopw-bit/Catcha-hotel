import { BUSINESS, ROOMS } from "@/lib/business";
import { getAppUrl } from "@/lib/app-url";

/**
 * Schema.org ของร้าน — ใช้ชุดเดียวกันทุกหน้าสาธารณะ
 *
 * ทุกหน้าใช้ @id เดียวกัน (`<โดเมน>#business`) Google จะรวมเป็น "ธุรกิจเดียว" ที่มีหลายหน้า
 * แทนที่จะเห็นเป็นหลายร้านชื่อไม่ตรงกัน (เดิมหน้าโซนแต่ละหน้าตั้งชื่อร้านคนละแบบ)
 * ชื่อ/ที่อยู่/เบอร์ (NAP) ต้องตรงกับ Google Business Profile ของร้าน
 */

const SITE_URL = getAppUrl();

/** ที่อยู่ร้าน — คัดลอกตรงจาก Google Maps (2026-11-13) ต้องตรงกับ Google Business Profile ทุกตัวอักษร */
export const SHOP_ADDRESS = {
  street: "96/9 บางแก้ว 9 ถนน เลียบคลองหลวงแพ่ง",
  district: "อำเภอบางพลี",
  province: "สมุทรปราการ",
  postalCode: "10540",
  full: "96/9 บางแก้ว 9 ถนน เลียบคลองหลวงแพ่ง อำเภอบางพลี สมุทรปราการ 10540",
};
export const BUSINESS_ID = `${SITE_URL}#business`;

/** ทุกย่านที่ร้านให้บริการ — รวมคำสะกดที่คนพิมพ์ค้นจริง (เมกาบางนา/เมกะบางนา) */
export const SERVICE_AREAS = [
  "บางนา",
  "เมกาบางนา",
  "เมกะบางนา",
  "เทพารักษ์",
  "หนามแดง",
  "ศรีนครินทร์",
  "พัฒนาการ",
  "แบริ่ง",
  "ลาซาล",
  "อุดมสุข",
  "สำโรง",
  "บางพลี",
  "บางแก้ว",
  "ปากน้ำ",
  "สมุทรปราการ",
];

export function localBusinessNode() {
  return {
    "@type": "LocalBusiness",
    "@id": BUSINESS_ID,
    name: "CatCha Hotel โรงแรมแมว อาบน้ำแมว",
    alternateName: [
      "CatCha Hotel",
      "แคทฉะ โฮเทล",
      "Catcha Cat Hotel",
      "Catcha Hotel โรงแรมแมวแคทฉะ อาบน้ำแมว บางนา หนามแดง สมุทรปราการ",
    ],
    description:
      "โรงแรมแมวและอาบน้ำแมว ย่านเทพารักษ์ หนามแดง สมุทรปราการ ใกล้บางนา เมกาบางนา ห้องแอร์ส่วนตัว CCTV รายงานเช้า-เย็น",
    url: SITE_URL,
    telephone: "+66805498969",
    contactPoint: [
      { "@type": "ContactPoint", telephone: "+66805498969", contactType: "reservations", availableLanguage: ["th", "en"] },
      { "@type": "ContactPoint", telephone: "+66953246989", contactType: "customer service", availableLanguage: ["th"] },
    ],
    priceRange: "฿350-฿1,450",
    image: `${SITE_URL}/logo.jpg`,
    logo: `${SITE_URL}/logo.jpg`,
    address: {
      "@type": "PostalAddress",
      streetAddress: SHOP_ADDRESS.street,
      addressLocality: SHOP_ADDRESS.district,
      addressRegion: SHOP_ADDRESS.province,
      postalCode: SHOP_ADDRESS.postalCode,
      addressCountry: "TH",
    },
    geo: { "@type": "GeoCoordinates", latitude: 13.6290175, longitude: 100.654973 },
    hasMap: BUSINESS.maps,
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "09:00",
        closes: "19:00",
      },
    ],
    sameAs: [
      BUSINESS.maps,
      BUSINESS.social.facebook,
      BUSINESS.social.instagram,
      BUSINESS.social.tiktok,
      BUSINESS.social.line,
    ],
    areaServed: SERVICE_AREAS.map((a) => ({ "@type": "Place", name: a })),
    knowsAbout: ["รับฝากแมว", "โรงแรมแมว", "อาบน้ำแมว", "ดูแลแมวขี้กลัว", "ดูแลแมวสูงวัย/แมวที่ต้องกินยา"],
    // ปุ่ม "จอง" ให้ Google/AI รู้ว่าจองทางไหน — LINE คือช่องทางหลัก
    potentialAction: {
      "@type": "ReserveAction",
      target: BUSINESS.social.line,
      name: "จองคิวทาง LINE @catchahotel",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "ห้องพักแมว",
      itemListElement: ROOMS.map((r) => ({
        "@type": "Offer",
        name: `${r.name} (${r.cats.th})`,
        price: String(r.price),
        priceCurrency: "THB",
      })),
    },
    makesOffer: [
      { "@type": "Offer", name: "รับฝากแมว ห้องพักแมวห้องแอร์", price: "350", priceCurrency: "THB" },
      { "@type": "Offer", name: "อาบน้ำแมว เป่าขน", price: "400", priceCurrency: "THB" },
    ],
  };
}

/** แถบเส้นทาง (หน้าแรก › หน้านี้) — Google ใช้โชว์ใต้ชื่อในผลค้นหา */
export function breadcrumbNode(name: string, path: string) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "CatCha Hotel", item: SITE_URL },
      { "@type": "ListItem", position: 2, name, item: `${SITE_URL}${path}` },
    ],
  };
}

export function faqNode(faqs: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}
