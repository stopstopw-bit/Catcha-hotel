/** เก็บ/สรุปยอดเปิดหน้า /links และคลิกปุ่ม — ตาราง link_clicks (migration link_clicks.setup) */
import { getSupabase } from "./supabase/server";
import { ensureMigration } from "./migrations";

export type LinkEventKind = "view" | "click";

function missingTable(msg: string): boolean {
  return /link_clicks|relation .* does not exist|schema cache/i.test(msg);
}

/** บันทึก 1 เหตุการณ์ — ห้ามทำให้หน้า/redirect พัง: error ทุกแบบกลืนเงียบ */
export async function recordLinkEvent(kind: LinkEventKind, src: string, target?: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const row = { kind, src, target: target ?? null };
  try {
    const { error } = await sb.from("link_clicks").insert(row);
    if (error && missingTable(error.message || "")) {
      if (await ensureMigration("link_clicks.setup")) await sb.from("link_clicks").insert(row);
    }
  } catch {
    /* นับไม่ได้ก็ปล่อย — สำคัญกว่าคือพาลูกค้าไปถึงปลายทาง */
  }
}

export type LinkStatsRow = { src: string; views: number; clicks: number; byButton: Record<string, number> };
export type LinkStats = {
  days: number;
  totalViews: number;
  totalClicks: number;
  platforms: LinkStatsRow[];
  buttons: { key: string; clicks: number }[];
  /** ตารางยังไม่ถูกสร้าง (ยังไม่มีใครเปิดหน้า) */
  empty: boolean;
};

export async function getLinkStats(days: number): Promise<LinkStats> {
  const out: LinkStats = { days, totalViews: 0, totalClicks: 0, platforms: [], buttons: [], empty: true };
  const sb = getSupabase();
  if (!sb) return out;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows: { kind: string; src: string; target: string | null }[] = [];
  // ดึงทีละหน้า 1000 แถว (ค่าจำกัดของ PostgREST) สูงสุด 50k
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await sb
      .from("link_clicks")
      .select("kind,src,target")
      .gte("created_at", since)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error || !data) break;
    rows.push(...(data as typeof rows));
    if (data.length < 1000) break;
  }
  if (rows.length === 0) return out;
  out.empty = false;
  const bySrc = new Map<string, LinkStatsRow>();
  const byBtn = new Map<string, number>();
  for (const r of rows) {
    const p = bySrc.get(r.src) ?? { src: r.src, views: 0, clicks: 0, byButton: {} };
    if (r.kind === "view") {
      p.views++;
      out.totalViews++;
    } else {
      p.clicks++;
      out.totalClicks++;
      const k = r.target || "?";
      p.byButton[k] = (p.byButton[k] ?? 0) + 1;
      byBtn.set(k, (byBtn.get(k) ?? 0) + 1);
    }
    bySrc.set(r.src, p);
  }
  out.platforms = [...bySrc.values()].sort((a, b) => b.clicks - a.clicks || b.views - a.views);
  out.buttons = [...byBtn.entries()].map(([key, clicks]) => ({ key, clicks })).sort((a, b) => b.clicks - a.clicks);
  return out;
}
