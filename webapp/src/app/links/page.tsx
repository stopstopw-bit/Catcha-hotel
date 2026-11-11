import type { Metadata } from "next";
import LinkHubPage from "@/components/LinkHubPage";
import { BUSINESS } from "@/lib/business";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${BUSINESS.name} · ลิงก์ทั้งหมด`,
  description: `${BUSINESS.tagline.th} · ${BUSINESS.location.th} — ทัก LINE จองคิว ดูห้องพัก อาบน้ำแมว โปรโมชั่น`,
  alternates: { canonical: "/links" },
  openGraph: { images: ["/logo.jpg"] },
};

export default function LinksPage() {
  return <LinkHubPage />;
}
