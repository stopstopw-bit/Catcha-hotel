import { NextResponse } from "next/server";
import {
  runMigrations,
  checkSchema,
  EXEC_SQL_BOOTSTRAP,
  MIGRATIONS,
} from "@/lib/migrations";

export const runtime = "nodejs";

/** ดูสถานะ + SQL ตั้งค่าครั้งแรก (ไม่แก้อะไร)
 *  ?check=1 = ยิงอ่านจริงว่าคอลัมน์/ตารางที่ฟีเจอร์ต้องใช้มีอยู่จริงไหม */
export async function GET(req: Request) {
  const wantCheck = new URL(req.url).searchParams.get("check") === "1";
  return NextResponse.json({
    migrations: MIGRATIONS.map((m) => m.name),
    bootstrapSql: EXEC_SQL_BOOTSTRAP,
    ...(wantCheck ? { check: await checkSchema() } : {}),
  });
}

/**
 * รัน migration ทั้งหมด (idempotent).
 * ปลอดภัย: endpoint นี้รันเฉพาะ SQL ที่ hardcode ในโค้ด (ไม่รับ SQL จากภายนอก)
 * และ exec_sql เรียกได้เฉพาะ service role.
 */
export async function POST() {
  const res = await runMigrations();
  return NextResponse.json({ ...res, bootstrapSql: res.bootstrapNeeded ? EXEC_SQL_BOOTSTRAP : undefined });
}
