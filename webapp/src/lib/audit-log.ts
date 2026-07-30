import { getSupabase } from "./supabase/server";

/**
 * บันทึกว่าใครทำอะไรกับเงินและสิทธิ์ของลูกค้า
 *
 * ร้านที่มีพนักงานหลายคนใช้รหัสคนละตัว พอยอดเงินไม่ตรงหรือแต้มลูกค้าหาย จะไล่ไม่ได้เลย
 * ว่าเกิดจากใครและตอนไหน — เก็บเฉพาะการกระทำที่ย้อนกลับยากหรือกระทบเงิน
 * ไม่เก็บการอ่านข้อมูลทั่วไป เพราะจะกลายเป็นกองข้อมูลที่ไม่มีใครอ่าน
 *
 * ล้มเหลวเงียบเสมอ — บันทึกไม่ได้ต้องไม่ทำให้การรับเงิน/ปิดบิลพังตาม
 */
export type AuditEntry = {
  /** ใครทำ — ชื่อพนักงานจากคุกกี้ล็อกอิน */
  actor: string;
  /** ทำอะไร เช่น "mark_paid" "delete_invoice" "adjust_points" */
  action: string;
  /** ทำกับอะไร เช่น "invoice" "customer" "finance" */
  resourceType: string;
  resourceId?: string;
  /** รายละเอียดที่ช่วยให้ย้อนดูได้ว่าเกิดอะไรขึ้น (ยอดเงิน เหตุผล ฯลฯ) */
  detail?: Record<string, unknown>;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from("audit_logs").insert({
      actor: entry.actor || "ไม่ทราบ",
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId || null,
      detail: entry.detail ?? null,
      created_at: new Date().toISOString(),
    });
  } catch {
    /* ยังไม่ได้อัปเดตฐานข้อมูล / เขียนไม่ได้ — ไม่ให้กระทบงานหลัก */
  }
}

export type AuditRow = {
  id: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  detail?: Record<string, unknown>;
  createdAt: string;
};

/** อ่าน log ล่าสุด — ใช้ในหน้าหลังบ้าน */
export async function listAudit(limit = 200): Promise<AuditRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(500, Math.max(1, limit)));
    return ((data as Record<string, unknown>[] | null) || []).map((r) => ({
      id: String(r.id),
      actor: String(r.actor || ""),
      action: String(r.action || ""),
      resourceType: String(r.resource_type || ""),
      resourceId: (r.resource_id as string) || undefined,
      detail: (r.detail as Record<string, unknown>) || undefined,
      createdAt: String(r.created_at || ""),
    }));
  } catch {
    return [];
  }
}
