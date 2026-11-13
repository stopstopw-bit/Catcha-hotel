import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/app-url";

const SITE_URL = getAppUrl();

// หน้าแอปสมาชิก/หลังบ้าน ไม่ต้อง index — ให้บอทโฟกัสหน้าเว็บหลัก
const PRIVATE = ["/admin", "/api", "/app", "/doc"];

/**
 * บอทของ AI search — เปิดให้อ่านหน้าเว็บร้านชัด ๆ (ไม่บล็อก) เพื่อให้ ChatGPT / Claude / Gemini / Perplexity
 * ดึงข้อมูลร้านไปตอบคนที่ถามหาโรงแรมแมว/อาบน้ำแมวแถวบางนาได้
 */
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
