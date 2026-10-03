import { getDefaultSiteConfig } from "./defaults/site-config";
import type { SiteConfig } from "./config-types";
import { getSupabase } from "./supabase/server";
import { uploadDataUrlToStorage } from "./supabase/storage";
import { createHash } from "crypto";

const CONFIG_ID = "main";
let memConfig: SiteConfig | null = null;

/**
 * ย้ายรูปที่ฝังเป็น base64 (data:image/...) ในค่าตั้งค่าออกไป Storage แล้วแทนด้วย URL
 *
 * ทำไมต้องทำ: site_config ถูกอ่านทุกครั้งที่เปิดแอป/หน้าเว็บ/cron ถ้ามีรูปโปสเตอร์ห้อง
 * บล็อกเนื้อหา โลโก้ ฯลฯ ยัดเป็น base64 อยู่ในนั้น ทุกคำขอจะโหลดรูปทั้งหมดซ้ำๆ หลาย MB
 * จนโควตา egress ของ Supabase หมดภายในไม่กี่วัน แล้วโปรเจกต์ถูกจำกัดการใช้งานทั้งก้อน
 * (ร้านเจอมาแล้ว: "exceed_egress_quota" → ทุกหน้าว่างเปล่าเหมือนข้อมูลหาย)
 *
 * เดินทุกค่าที่เป็น string ใน config — ตัวไหนขึ้นต้นด้วย data:image ให้อัปขึ้น Storage
 * (ตั้งชื่อไฟล์จาก hash ของเนื้อรูป จะได้ไม่อัปซ้ำถ้าบันทึกใหม่โดยไม่ได้เปลี่ยนรูป)
 * อัปไม่สำเร็จก็คง data URL ไว้ตามเดิม ไม่ให้การบันทึกพัง
 */
async function offloadDataUrls<T>(value: T, path = "config"): Promise<T> {
  if (typeof value === "string") {
    if (!value.startsWith("data:image")) return value;
    const hash = createHash("sha1").update(value).digest("hex").slice(0, 12);
    return (await uploadDataUrlToStorage(`${path}/${hash}`, value)) as unknown as T;
  }
  if (Array.isArray(value)) {
    return (await Promise.all(value.map((v) => offloadDataUrls(v, path)))) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = await offloadDataUrls(v, path);
    }
    return out as T;
  }
  return value;
}

function hasDataUrl(value: unknown): boolean {
  if (typeof value === "string") return value.startsWith("data:image");
  if (Array.isArray(value)) return value.some(hasDataUrl);
  if (value && typeof value === "object") return Object.values(value).some(hasDataUrl);
  return false;
}

/** ซ่อมค่าที่เก็บไว้ก่อนหน้า (มี base64 ค้าง) ครั้งเดียวต่อ instance — ไม่ให้หลายคำขอแย่งกันซ่อม */
let repairing: Promise<void> | null = null;

function mergeConfig(base: SiteConfig, patch: Partial<SiteConfig>): SiteConfig {
  const next = JSON.parse(JSON.stringify(base)) as SiteConfig;
  for (const key of Object.keys(patch) as (keyof SiteConfig)[]) {
    const val = patch[key];
    if (val === undefined) continue;
    if (
      typeof val === "object" &&
      val !== null &&
      !Array.isArray(val) &&
      key !== "rooms" &&
      key !== "groomSlots" &&
      key !== "pointsRewards"
    ) {
      (next as Record<string, unknown>)[key] = {
        ...(next as Record<string, unknown>)[key] as object,
        ...val,
      };
    } else {
      (next as Record<string, unknown>)[key] = val;
    }
  }
  return next;
}

export async function getSiteConfig(): Promise<SiteConfig> {
  const defaults = getDefaultSiteConfig();
  const sb = getSupabase();

  if (sb) {
    const { data } = await sb
      .from("site_config")
      .select("data, updated_at")
      .eq("id", CONFIG_ID)
      .maybeSingle();

    if (data?.data) {
      const stored = data.data as Partial<SiteConfig>;
      // ค่าเก่าที่ยังฝัง base64 อยู่ → ย้ายออกไป Storage แล้วบันทึกกลับทีเดียว คำขอต่อๆ ไปจะเบาลงทันที
      if (!repairing && hasDataUrl(stored)) {
        repairing = (async () => {
          const slim = await offloadDataUrls(stored);
          if (!hasDataUrl(slim)) {
            await sb
              .from("site_config")
              .update({ data: slim })
              .eq("id", CONFIG_ID);
          }
        })().catch(() => {});
      }
      return mergeConfig(defaults, {
        ...stored,
        updatedAt: data.updated_at || defaults.updatedAt,
      });
    }
  }

  if (memConfig) return memConfig;
  return defaults;
}

export async function replaceSiteConfig(config: SiteConfig) {
  const next = {
    ...(await offloadDataUrls(config)),
    updatedAt: new Date().toISOString(),
    version: (config.version || 0) + 1,
  };
  const sb = getSupabase();
  if (sb) {
    await sb.from("site_config").upsert({
      id: CONFIG_ID,
      data: next,
      updated_at: next.updatedAt,
    });
  } else {
    memConfig = next;
  }
  return next;
}

export async function updateSiteConfig(patch: Partial<SiteConfig>) {
  const current = await getSiteConfig();
  const next = mergeConfig(current, await offloadDataUrls(patch));
  next.updatedAt = new Date().toISOString();
  next.version = (current.version || 0) + 1;

  const sb = getSupabase();
  if (sb) {
    await sb.from("site_config").upsert({
      id: CONFIG_ID,
      data: next,
      updated_at: next.updatedAt,
    });
  } else {
    memConfig = next;
  }

  return next;
}

export function getRoomFromConfig(config: SiteConfig, id: string) {
  return config.rooms.find((r) => r.id === id);
}
