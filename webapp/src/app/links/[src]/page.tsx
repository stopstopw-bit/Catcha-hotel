import type { Metadata } from "next";
import LinkHubPage from "@/components/LinkHubPage";
import { BUSINESS } from "@/lib/business";

export const dynamic = "force-dynamic";

// /links/ig, /links/tiktok ... หน้าเดียวกับ /links แค่บอกว่ามาจากแพลตฟอร์มไหน — ให้ Google นับเป็น /links หน้าเดียว
export const metadata: Metadata = {
  title: `${BUSINESS.name} · ลิงก์ทั้งหมด`,
  description: `${BUSINESS.tagline.th} · ${BUSINESS.location.th} — ทัก LINE จองคิว ดูห้องพัก อาบน้ำแมว โปรโมชั่น`,
  alternates: { canonical: "/links" },
  robots: { index: false, follow: true },
  openGraph: { images: ["/logo.jpg"] },
};

export default async function LinksFromPage({ params }: { params: Promise<{ src: string }> }) {
  const { src } = await params;
  return <LinkHubPage src={src} />;
}
