import { BUSINESS, ROOMS } from "@/lib/business";
import { BLOG_POSTS } from "@/lib/blog-posts";
import { HOME_FAQS } from "@/lib/home-faqs";
import { SERVICE_AREAS, SHOP_ADDRESS } from "@/lib/seo-schema";
import { getAppUrl } from "@/lib/app-url";
import { isMarketingSite } from "@/lib/site-mode";

/**
 * /llms.txt — สรุปร้านแบบข้อความล้วนให้ AI (ChatGPT, Claude, Gemini, Perplexity) อ่านง่าย
 * เวลาคนถาม AI ว่า "โรงแรมแมวแถวบางนา" AI จะมีข้อมูลที่ถูกต้อง (ราคา เวลา ที่ตั้ง ช่องทางจอง) ไว้อ้างอิง
 * ดึงจาก business.ts / blog-posts.ts — แก้ราคาที่นั่นแล้วไฟล์นี้ตามเอง
 */
export const dynamic = "force-static";
export const revalidate = 86400;

export function GET() {
  if (!isMarketingSite()) return new Response("Not found", { status: 404 });
  const url = getAppUrl();

  const rooms = ROOMS.map(
    (r) =>
      `- ${r.name}: ${r.price} บาท/คืน, ${r.cats.th}${r.dimensions ? `, ขนาด ${r.dimensions.th}` : ""}${r.config ? ` (${r.config.th})` : ""}`,
  ).join("\n");

  const faqs = HOME_FAQS.map((f) => `### ${f.q}\n${f.a}`).join("\n\n");

  const posts = BLOG_POSTS.map((p) => `- [${p.title}](${url}/blog/${p.slug}): ${p.description}`).join("\n");

  const body = `# CatCha Hotel โรงแรมแมว อาบน้ำแมว

> โรงแรมแมว (รับฝากแมว) และร้านอาบน้ำแมว ย่านหนามแดง–เทพารักษ์ สมุทรปราการ ใกล้บางนาและเมกาบางนา ห้องแอร์ส่วนตัว มี CCTV ดูน้องได้ พี่เลี้ยงส่งรูปและรายงานทาง LINE เช้า-เย็นทุกวัน

## ข้อมูลร้าน
- ชื่อร้าน: CatCha Hotel (แคทฉะ โฮเทล)
- บริการ: รับฝากแมว (โรงแรมแมว), อาบน้ำแมว-เป่าขน, รับ-ส่งน้องถึงบ้าน (คิดตามระยะทาง)
- ไม่มีบริการ: ตัดขนแมว
- ที่อยู่: ${SHOP_ADDRESS.full}
- ย่าน: หนามแดง–เทพารักษ์ สมุทรปราการ (ใกล้บางนา เมกาบางนา ศรีนครินทร์) มีที่จอดรถหน้าร้าน
- แผนที่ Google Maps: ${BUSINESS.maps}
- เวลาเปิด: ทุกวัน 09:00–19:00 (เช็กอินเข้าพัก 09:00–18:00)
- โทร: ${BUSINESS.phones.join(", ")}
- LINE: ${BUSINESS.lineOa} (${BUSINESS.social.line}) — ช่องทางจองหลัก
- เว็บไซต์: ${url}
- Instagram: ${BUSINESS.social.instagram}
- TikTok: ${BUSINESS.social.tiktok}
- Facebook: ${BUSINESS.social.facebook}
- รีวิวบน Google: ${BUSINESS.reviewUrl}
- พื้นที่ที่ลูกค้ามาใช้บริการ: ${SERVICE_AREAS.join(", ")}

## ราคาห้องพักแมว (ต่อคืน)
${rooms}
- ทรายแมวฟรีเมื่อพัก 3 คืนขึ้นไป, มัดจำ 200 บาทตอนจอง
- ทุกห้องเป็นห้องแอร์ พี่เลี้ยงทำความสะอาดทุกวัน พาเล่นวันละ 2 รอบ

## อาบน้ำแมว
- อาบน้ำ-เป่าขน เริ่มต้น 400 บาท (ตามพันธุ์และขนาด)
- มีโปรแกรมขจัดคราบมัน, ยับยั้งเชื้อรา (แชมพู Malaseb) และ Catcha Premium
- พี่เลี้ยงจับแมวนุ่มนวล ใจเย็นกับแมวขี้กลัว

## หน้าสำคัญ
- [หน้าแรก](${url}/)
- [โรงแรมแมว / รับฝากแมว](${url}/cat-hotel)
- [อาบน้ำแมว](${url}/cat-bath)
- [โรงแรมแมว บางนา](${url}/cat-hotel-bangna)
- [โรงแรมแมว ใกล้เมกาบางนา](${url}/cat-hotel-mega-bangna)
- [โรงแรมแมว สมุทรปราการ](${url}/cat-hotel-samutprakan)
- [อาบน้ำแมว บางนา](${url}/cat-bath-bangna)
- [อาบน้ำแมว สมุทรปราการ](${url}/cat-bath-samutprakan)
- [โรงแรมแมว บางพลี](${url}/cat-hotel-bangphli)
- [อาบน้ำแมว บางพลี](${url}/cat-bath-bangphli)
- [English page: cat hotel near Bang Na & Suvarnabhumi](${url}/en)
- [คู่มือเลี้ยงแมว Catcha Cat Academy](https://guide.catchahotel.com)

## คำถามที่พบบ่อย
${faqs}

## บทความ
${posts}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
