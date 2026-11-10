/**
 * คัดลอกข้อมูลร้านจาก Supabase ที่ใช้อยู่ ไปห้อง (schema) ของร้านในโปรเจกต์ Supabase อื่น
 * ใช้ครั้งเดียวตอนย้ายไปใช้โปรเจกต์ร่วมกับ PetFlow เพื่อลดค่าใช้จ่าย
 *
 * ตั้งใน Vercel (ระหว่างย้ายเท่านั้น):
 *   MOVE_TO_SUPABASE_URL              = URL ของโปรเจกต์ปลายทาง
 *   MOVE_TO_SUPABASE_SERVICE_ROLE_KEY = service_role key ของโปรเจกต์ปลายทาง
 *   MOVE_TO_SCHEMA                    = ชื่อห้อง (ไม่ใส่ = catcha)
 *
 * - เว็บยังใช้ฐานเดิมตามปกติระหว่างคัดลอก กดซ้ำได้ (upsert ตาม primary key ไม่เกิดแถวซ้ำ)
 * - ฐานเดิมไม่ถูกแก้อะไรเลย → ย้อนกลับได้แค่เปลี่ยน env กลับ
 * - ทำทีละขั้น (เตรียมห้อง / ทีละตาราง / ไฟล์ทีละชุด) กันหมดเวลา 60 วินาทีของ Vercel
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";
import { getDbSchema, getMediaBucket, getSupabase, getSupabaseUrl, normalizeSupabaseUrl } from "@/lib/supabase/server";
import { execSqlBootstrap, runMigrations, schemaGrantSql, schemaPreludeSql } from "@/lib/migrations";

/** ตารางแม่มาก่อนตารางลูก (foreign key) */
export const MOVE_TABLES = [
  "customers",
  "cats",
  "bookings",
  "points_accounts",
  "points_history",
  "promos",
  "promo_claims",
  "finance_records",
  "invoices",
  "service_records",
  "member_topups",
  "site_config",
  "broadcast_images",
  "coupons",
  "coupon_offers",
  "customer_packages",
  "package_offers",
  "package_orders",
  "chat_watch",
  "articles",
  "staff_users",
  "birthday_greetings",
  "room_plans",
  "invoice_docs",
  "pos_products",
  "pos_stock_moves",
  "pos_sales",
  "pos_closings",
  "audit_logs",
] as const;

const PAGE = 200;
const FILE_BATCH = 40;

type Target = { url: string; key: string; schema: string };

function targetConfig(): Target | null {
  const url = normalizeSupabaseUrl(process.env.MOVE_TO_SUPABASE_URL);
  const key = process.env.MOVE_TO_SUPABASE_SERVICE_ROLE_KEY?.trim();
  const raw = (process.env.MOVE_TO_SCHEMA || "catcha").trim().toLowerCase();
  if (!url || !key || !/^[a-z_][a-z0-9_]{0,40}$/.test(raw) || raw === "public") return null;
  return { url, key, schema: raw };
}

function bucketFor(schema: string) {
  return `${schema.replace(/_/g, "-")}-media`;
}

const AUTH = { persistSession: false, autoRefreshToken: false };

/** client ปลายทางที่ชี้ห้องของร้าน */
function targetDb(t: Target): SupabaseClient {
  return createClient(t.url, t.key, { auth: AUTH, db: { schema: t.schema } }) as unknown as SupabaseClient;
}

/** client ปลายทางที่ชี้ห้อง public — ใช้ public.exec_sql ที่ PetFlow มีอยู่แล้ว สร้างห้องใหม่ */
function targetPublic(t: Target): SupabaseClient {
  return createClient(t.url, t.key, { auth: AUTH });
}

export type MoveStatus = { ready: boolean; message: string; from?: string; to?: string; schema?: string };

export function moveStatus(): MoveStatus {
  const t = targetConfig();
  const from = getSupabaseUrl();
  if (!t) {
    return {
      ready: false,
      message: "ยังไม่ได้ตั้ง MOVE_TO_SUPABASE_URL / MOVE_TO_SUPABASE_SERVICE_ROLE_KEY ใน Vercel",
    };
  }
  if (!from || !getSupabase()) return { ready: false, message: "เว็บยังไม่ได้ต่อฐานข้อมูลเดิม" };
  if (from === t.url && getDbSchema() === t.schema) {
    return { ready: false, message: "เว็บใช้ฐานปลายทางอยู่แล้ว (ย้ายเสร็จแล้ว) — ลบ MOVE_TO_* ออกจาก Vercel ได้" };
  }
  return {
    ready: true,
    message: `${new URL(from).hostname} → ${new URL(t.url).hostname} (ห้อง ${t.schema})`,
    from: new URL(from).hostname,
    to: new URL(t.url).hostname,
    schema: t.schema,
  };
}

function need(): { src: SupabaseClient; t: Target; fromUrl: string } {
  const t = targetConfig();
  const src = getSupabase();
  const fromUrl = getSupabaseUrl();
  if (!t || !src || !fromUrl) throw new Error(moveStatus().message);
  return { src, t, fromUrl };
}

function schemaSql() {
  return readFileSync(join(process.cwd(), "supabase", "schema.sql"), "utf-8");
}

/** ขั้น 1: สร้างห้อง + ตารางทั้งหมด + exec_sql ของห้อง แล้วรัน migration ให้คอลัมน์ครบเท่าฐานเดิม */
export async function prepareTarget() {
  const { t } = need();
  const pub = targetPublic(t);
  const setup = `${schemaPreludeSql(t.schema)}
set search_path to ${t.schema};
${schemaSql()}
${schemaGrantSql(t.schema)}
${execSqlBootstrap(t.schema)}`;
  const { error } = await pub.rpc("exec_sql", { sql: setup });
  if (error) {
    throw new Error(
      `สร้างห้อง ${t.schema} ในฐานปลายทางไม่ได้: ${error.message} — ฐานปลายทางต้องมีฟังก์ชัน public.exec_sql (PetFlow มีอยู่แล้ว)`
    );
  }
  // ให้ PostgREST รู้จักห้องใหม่ แล้วรอสักครู่ก่อนเรียกใช้
  await new Promise((r) => setTimeout(r, 1500));
  const db = targetDb(t);
  const probe = await db.from("site_config").select("id").limit(1);
  if (probe.error) {
    if (/schema|PGRST106/i.test(probe.error.message + (probe.error.code || ""))) {
      throw new Error(
        `ฐานปลายทางยังไม่เปิดให้ใช้ห้อง "${t.schema}" — ไปที่ Supabase ของปลายทาง › Project Settings › Data API › Exposed schemas เพิ่ม ${t.schema} แล้วกด Save จากนั้นกดใหม่`
      );
    }
    throw new Error(`อ่านห้อง ${t.schema} ไม่ได้: ${probe.error.message}`);
  }
  const mig = await runMigrations(db);
  return { schema: t.schema, migrations: mig.applied.length, migrationErrors: mig.errors };
}

/** เปลี่ยนลิงก์รูปจาก bucket เดิมของโปรเจกต์เดิม → bucket ของห้องในโปรเจกต์ใหม่ */
function rewriteUrls<T>(rows: T[], fromUrl: string, t: Target): T[] {
  const from = `${fromUrl}/storage/v1/object/public/${getMediaBucket()}/`;
  const to = `${t.url}/storage/v1/object/public/${bucketFor(t.schema)}/`;
  const s = JSON.stringify(rows);
  return s.includes(from) ? (JSON.parse(s.split(from).join(to)) as T[]) : rows;
}

/** ขั้น 2: คัดลอกตารางเดียว — คืนจำนวนแถวต้นทาง/ปลายทางให้เทียบ */
export async function copyTable(table: string) {
  if (!(MOVE_TABLES as readonly string[]).includes(table)) throw new Error("ไม่รู้จักตารางนี้");
  const { src, t, fromUrl } = need();
  const dst = targetDb(t);
  let copied = 0;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await src.from(table).select("*").range(offset, offset + PAGE - 1);
    if (error) {
      // ตารางนี้ไม่มีในฐานเดิม (ฟีเจอร์ที่ไม่เคยเปิด) = ไม่มีอะไรให้ย้าย
      if (error.code === "42P01" || error.code === "PGRST205") return { table, source: 0, target: 0, copied };
      throw new Error(`${table}: อ่านฐานเดิมไม่ได้ — ${error.message}`);
    }
    if (!data || data.length === 0) break;
    const { error: upErr } = await dst.from(table).upsert(rewriteUrls(data, fromUrl, t));
    if (upErr) throw new Error(`${table}: เขียนฐานใหม่ไม่ได้ — ${upErr.message}`);
    copied += data.length;
    if (data.length < PAGE) break;
  }
  if (table === "audit_logs") {
    // id เป็นเลขรัน — ตั้งตัวนับให้ต่อจากเลขสุดท้าย ไม่งั้นบันทึกใหม่จะชนกับของเดิม
    await dst.rpc("exec_sql", {
      sql: "select setval(pg_get_serial_sequence('audit_logs','id'), greatest(coalesce((select max(id) from audit_logs), 0), 1));",
    });
  }
  const [a, b] = await Promise.all([
    src.from(table).select("*", { count: "exact", head: true }),
    dst.from(table).select("*", { count: "exact", head: true }),
  ]);
  return { table, source: a.count ?? 0, target: b.count ?? 0, copied };
}

async function listAllFiles(sb: SupabaseClient, bucket: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) out.push(path);
      else out.push(...(await listAllFiles(sb, bucket, path)));
    }
    if (data.length < 1000) break;
  }
  return out;
}

/** ขั้น 3: คัดลอกรูปทีละชุด — เรียกซ้ำโดยส่ง offset ถัดไปจนกว่า done */
export async function copyFiles(offset: number) {
  const { src, t } = need();
  const dst = targetPublic(t);
  const srcBucket = getMediaBucket();
  const dstBucket = bucketFor(t.schema);
  let paths: string[];
  try {
    paths = (await listAllFiles(src, srcBucket)).sort();
  } catch {
    return { total: 0, offset, copied: 0, failed: [] as string[], done: true };
  }
  if (offset === 0) {
    await dst.storage.createBucket(dstBucket, { public: true, fileSizeLimit: "25MB" }).catch(() => null);
  }
  const batch = paths.slice(offset, offset + FILE_BATCH);
  let copied = 0;
  const failed: string[] = [];
  for (const path of batch) {
    const { data, error } = await src.storage.from(srcBucket).download(path);
    if (error || !data) {
      failed.push(path);
      continue;
    }
    const { error: upErr } = await dst.storage
      .from(dstBucket)
      .upload(path, data, { upsert: true, contentType: data.type || undefined });
    if (upErr) failed.push(path);
    else copied++;
  }
  const next = offset + batch.length;
  return { total: paths.length, offset: next, copied, failed, done: next >= paths.length };
}
