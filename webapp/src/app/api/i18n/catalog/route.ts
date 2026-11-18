import { NextRequest, NextResponse } from "next/server";
import { getCatalogEn, listCatalogEn, saveCatalogEn } from "@/lib/catalog-en";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

async function isAdmin(req: NextRequest) {
  return !!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value));
}

/**
 * GET → { map } ไทย→อังกฤษ ของชื่อโปร/คอร์ส/แพ็กเกจ (ลูกค้า English ใช้แสดงผล)
 * GET ?list=1 (หลังบ้าน) → { entries } ให้ร้านตรวจ/แก้คำแปล
 */
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("list") === "1") {
    if (!(await isAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ entries: await listCatalogEn() });
  }
  const map = await getCatalogEn();
  return NextResponse.json({ map }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
}

/** POST { edits: [{ th, en }] } (หลังบ้าน) — en ว่าง = ให้ระบบแปลให้ใหม่ */
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const edits = Array.isArray(body.edits) ? body.edits.slice(0, 500) : [];
  await saveCatalogEn(edits);
  return NextResponse.json({ ok: true, entries: await listCatalogEn() });
}
