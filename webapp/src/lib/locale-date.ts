/** วันที่ตามภาษาลูกค้า — ไทย: "18 พ.ย. 69" · อังกฤษ: "18 Nov 2026" (เวลาไทย) */
const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string): { y: number; m: number; d: number } | null {
  if (!iso) return null;
  const s = iso.length <= 10 ? `${iso}T12:00:00+07:00` : iso;
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  const bkk = new Date(dt.getTime() + 7 * 3600 * 1000);
  return { y: bkk.getUTCFullYear(), m: bkk.getUTCMonth(), d: bkk.getUTCDate() };
}

export function dateFor(iso: string, en: boolean): string {
  const p = parts(iso);
  if (!p) return iso;
  return en ? `${p.d} ${EN_MONTHS[p.m]} ${p.y}` : `${p.d} ${TH_MONTHS[p.m]} ${String(p.y + 543).slice(-2)}`;
}

export function dateRangeFor(from: string, to: string | undefined, en: boolean): string {
  if (!to || to === from) return dateFor(from, en);
  return `${dateFor(from, en)} – ${dateFor(to, en)}`;
}
