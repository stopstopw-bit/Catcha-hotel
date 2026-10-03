import { readFileSync } from "fs";
import { join } from "path";
import { getSupabase, getSupabaseUrl, isSupabaseConfigured } from "./server";

export type SetupStatus = {
  supabaseUrl: boolean;
  serviceKey: boolean;
  databaseUrl: boolean;
  connected: boolean;
  tablesReady: boolean;
  missingTables: string[];
  message: string;
  /** ข้อความ error จริงจาก Supabase ของตารางแรกที่อ่านไม่ได้ — ไว้แยกว่า "ไม่มีตาราง" กับ "ต่อไม่ติด/คีย์ผิด/โปรเจกต์หยุด" */
  dbError?: string;
  /** true = ทุกตารางที่ต้องมีอ่านไม่ได้เลย — แทบไม่เคยแปลว่าตารางหาย แต่แปลว่าฐานข้อมูลตอบไม่ได้ทั้งก้อน */
  allFailed: boolean;
};

const REQUIRED_TABLES = [
  "customers",
  "cats",
  "bookings",
  "points_accounts",
  "promos",
  "invoices",
  "site_config",
];

export async function checkSetupStatus(): Promise<SetupStatus> {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseUrl = Boolean(rawUrl);
  const serviceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const databaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const normalizedUrl = getSupabaseUrl();

  if (!supabaseUrl || !serviceKey) {
    return {
      supabaseUrl,
      serviceKey,
      databaseUrl,
      connected: false,
      tablesReady: false,
      missingTables: REQUIRED_TABLES,
      allFailed: true,
      message: "ยังไม่ได้ใส่ NEXT_PUBLIC_SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ใน Vercel",
    };
  }

  if (!normalizedUrl) {
    return {
      supabaseUrl,
      serviceKey,
      databaseUrl,
      connected: false,
      tablesReady: false,
      missingTables: REQUIRED_TABLES,
      allFailed: true,
      message:
        "NEXT_PUBLIC_SUPABASE_URL ไม่ถูกต้อง — ใส่เป็น https://nqperjfuuntbzskbrqql.supabase.co (ไม่มีเครื่องหมายคำพูด)",
    };
  }

  const sb = getSupabase();
  if (!sb) {
    return {
      supabaseUrl,
      serviceKey,
      databaseUrl,
      connected: false,
      tablesReady: false,
      missingTables: REQUIRED_TABLES,
      allFailed: true,
      message: "เชื่อม Supabase ไม่ได้",
    };
  }

  const missing: string[] = [];
  let dbError: string | undefined;
  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await sb.from(table).select("*").limit(1);
      if (error) {
        missing.push(table);
        dbError ||= `${error.code ? `[${error.code}] ` : ""}${error.message}`;
      }
    } catch (e) {
      missing.push(table);
      dbError ||= e instanceof Error ? e.message : String(e);
    }
  }

  // ทุกตารางอ่านไม่ได้พร้อมกัน = ฐานข้อมูลไม่ตอบทั้งก้อน (โปรเจกต์ถูก pause / คีย์ผิด-ถูกหมุน / URL ชี้ผิดโปรเจกต์)
  // ไม่ใช่ "ตารางหาย" — ห้ามชวนให้กดสร้างตารางใหม่ เดี๋ยวไปสร้างของเปล่าทับที่ผิดที่
  const allFailed = missing.length === REQUIRED_TABLES.length;

  return {
    supabaseUrl,
    serviceKey,
    databaseUrl,
    connected: true,
    tablesReady: missing.length === 0,
    missingTables: missing,
    dbError,
    allFailed,
    message:
      missing.length === 0
        ? "พร้อมใช้งาน — ฐานข้อมูลครบแล้ว"
        : allFailed
          ? `ฐานข้อมูลตอบไม่ได้เลย (${dbError || "ไม่ทราบสาเหตุ"}) — เช็กว่าโปรเจกต์ Supabase ถูก pause หรือคีย์ใน Vercel ถูกต้องไหม ข้อมูลไม่ได้หาย`
          : `ยังไม่มีตาราง: ${missing.join(", ")} — กดสร้างตารางอัตโนมัติ`,
  };
}

function loadSchemaSql() {
  const path = join(process.cwd(), "supabase", "schema.sql");
  return readFileSync(path, "utf-8");
}

/** สร้างตารางทั้งหมด — ต้องมี DATABASE_URL (Connection string จาก Supabase) */
export async function bootstrapDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return {
      ok: false as const,
      error: "no_database_url",
      message:
        "ใส่ DATABASE_URL ใน Vercel (Supabase → Settings → Database → Connection string → URI)",
    };
  }

  const client = new (await import("pg")).default.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const sql = loadSchemaSql();
    await client.query(sql);
    return { ok: true as const, message: "สร้างตารางและข้อมูลเริ่มต้นสำเร็จ" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false as const, error: "bootstrap_failed", message: msg };
  } finally {
    await client.end().catch(() => {});
  }
}

export function getSchemaSqlForCopy() {
  return loadSchemaSql();
}

export function isSetupConfigured() {
  return isSupabaseConfigured();
}
