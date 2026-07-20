import type { MetadataRoute } from "next";

import { getAppUrl } from "@/lib/app-url";

const SITE_URL = getAppUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // หน้าแอปสมาชิก/หลังบ้าน ไม่ต้อง index — ให้บอทโฟกัสหน้าเว็บหลัก
        disallow: ["/admin", "/api", "/app"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
