"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminJson } from "@/lib/admin-fetch";
import { DateRangePicker } from "@/components/DateRangePicker";
import { resolveRange, type RangeId } from "@/lib/date-range";
import { IconChip, ListRowContent } from "@/components/HeaderBand";

type Stats = {
  today: string;
  queue: number;
  todayAppointments: number;
  todayConfirmed: number;
  salesToday: {
    total: number;
    count: number;
    creditTotal: number;
    creditCount: number;
    grossTotal: number;
    pending: number;
  };
  salesMonth: { total: number; count: number; pending: number };
  financeToday: { income: number; expense: number; net: number };
  financeMonth: { income: number; expense: number; net: number };
};

type Tasks = { unpaidCount: number; unpaidDue: number; pendingConsent: number };

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Tasks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** ช่วงเวลาของตัวเลขยอดขาย/บัญชี — คิว "รอยืนยัน" กับ "นัดวันนี้" ยึดวันนี้เสมอ */
  const [rangeId, setRangeId] = useState<RangeId>("today");
  const [customRange, setCustomRange] = useState(() => {
    const t = new Date().toISOString().slice(0, 10);
    return { from: t, to: t };
  });
  const range = resolveRange(rangeId, new Date().toISOString().slice(0, 10), customRange);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await adminJson<{ stats: Stats }>(
      `/api/admin/stats?from=${range.from}&to=${range.to}`
    );
    if (res.ok && res.data.stats) {
      setStats(res.data.stats);
    } else {
      setStats(null);
      setError(res.ok ? "โหลดสถิติไม่สำเร็จ" : res.error);
    }
    // งานที่ต้องทำ — บิลค้าง + ลูกค้ายังไม่กดยอมรับเงื่อนไข
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [invR, bkR] = await Promise.all([
        fetch("/api/invoices").then((r) => r.json()),
        fetch("/api/bookings").then((r) => r.json()),
      ]);
      const invs = (invR.invoices || []) as { status: string; total: number; deposit?: number }[];
      const bks = (bkR.bookings || []) as {
        service?: string;
        checkin?: string;
        consentAcceptedAt?: string;
        status?: string;
      }[];
      const pending = invs.filter((i) => i.status === "pending");
      setTasks({
        unpaidCount: pending.length,
        unpaidDue: pending.reduce((s, i) => s + (i.total - (i.deposit || 0)), 0),
        pendingConsent: bks.filter(
          (b) =>
            b.service === "room" &&
            b.status !== "cancelled" &&
            (b.checkin || "") >= today &&
            !b.consentAcceptedAt
        ).length,
      });
    } catch {
      setTasks(null);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  if (!stats) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-bold text-wait">{error || "โหลดไม่สำเร็จ"}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 rounded-catcha-sm bg-honey/40 px-4 py-2 text-xs font-bold"
        >
          🔄 ลองใหม่
        </button>
      </div>
    );
  }

  const hasTasks =
    stats.queue > 0 || (tasks && (tasks.unpaidCount > 0 || tasks.pendingConsent > 0));

  return (
    <div className="space-y-5">
      {/* การ์ดสรุป — เกยขึ้นไปบนแถบหัว */}
      <section className="relative rounded-catcha bg-card p-5 shadow-catcha">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-brown-soft">รายรับ · {range.label}</p>
            <p className="mt-1 text-3xl font-extrabold text-catcha-chocolate">
              {stats.financeToday.income.toLocaleString()}
              <span className="ml-1 text-base font-bold text-latte-deep">฿</span>
            </p>
            <p className="mt-0.5 text-[11px] text-brown-faint">
              {
                // ใช้ยอดจากบัญชีรายรับ ไม่ใช่เฉพาะบิล — ขายคอร์ส/เติมเครดิตก็คือเงินเข้าเหมือนกัน
                // (เมื่อก่อนการ์ดนี้นับเฉพาะบิล เลยไม่ตรงกับ "สุทธิ" ที่นับทุกอย่าง)
                [
                  `${stats.salesToday.count} บิล`,
                  stats.salesToday.creditTotal > 0
                    ? `ตัดเครดิต ${stats.salesToday.creditTotal.toLocaleString()} ฿`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")
              }
            </p>
          </div>
          <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-honey/35 text-2xl">
            💰
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 divide-x divide-catcha-line rounded-catcha-sm bg-paper/70 py-3 text-center">
          <MiniStat label="สุทธิ" value={`${stats.financeToday.net.toLocaleString()} ฿`} sub={
            stats.financeToday.expense > 0
              ? `หักจ่าย ${stats.financeToday.expense.toLocaleString()}`
              : "ยังไม่มีรายจ่าย"
          } />
          <MiniStat label="นัดวันนี้" value={String(stats.todayAppointments)} sub={`ยืนยัน ${stats.todayConfirmed}`} />
          <MiniStat label="รอยืนยัน" value={String(stats.queue)} sub="นัด" highlight={stats.queue > 0} />
        </div>
      </section>

      {/* เมนูลัด — ไอคอนกลมแบบหมวดหมู่ */}
      <nav aria-label="เมนูลัด" className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        <Link href="/admin/bookings/new"><IconChip icon="➕" label="จองใหม่" tone="honey" /></Link>
        <Link href="/admin/schedule"><IconChip icon="🗓️" label="ตารางนัด" tone="latte" /></Link>
        <Link href="/admin/billing"><IconChip icon="💳" label="คิดเงิน" tone="honey" /></Link>
        <Link href="/admin/customers"><IconChip icon="👤" label="ลูกค้า" tone="sage" /></Link>
        <Link href="/admin/finance"><IconChip icon="📒" label="รายรับ-จ่าย" tone="latte" /></Link>
        <Link href="/admin/pending"><IconChip icon="⏳" label="รอยืนยัน" tone="paper" badge={stats.queue || undefined} /></Link>
        <Link href="/admin/insights" className="sm:hidden"><IconChip icon="📊" label="สรุปข้อมูล" tone="sage" /></Link>
        <Link href="/admin/promos" className="sm:hidden"><IconChip icon="✨" label="โปร" tone="honey" /></Link>
      </nav>

      <DateRangePicker
        value={rangeId}
        onChange={setRangeId}
        custom={customRange}
        onCustomChange={setCustomRange}
      />

      {/* งานที่ต้องทำ */}
      {hasTasks && (
        <section className="rounded-catcha bg-card p-4 shadow-catcha-sm">
          <p className="mb-1 px-1 text-sm font-extrabold text-catcha-chocolate">
            📌 งานที่ต้องทำ
          </p>
          <div className="divide-y divide-catcha-line">
            {stats.queue > 0 && (
              <Link href="/admin/pending" className="block px-1 py-3">
                <ListRowContent
                  icon="⏳"
                  title="นัดรอยืนยัน"
                  sub="ลูกค้ายังไม่กดยืนยัน"
                  value={`${stats.queue} นัด →`}
                  valueClass="text-wait"
                />
              </Link>
            )}
            {tasks && tasks.unpaidCount > 0 && (
              <Link href="/admin/billing" className="block px-1 py-3">
                <ListRowContent
                  icon="💳"
                  title="บิลค้างชำระ"
                  sub={`${tasks.unpaidCount} บิล`}
                  value={`${tasks.unpaidDue.toLocaleString()} ฿ →`}
                  valueClass="text-wait"
                />
              </Link>
            )}
            {tasks && tasks.pendingConsent > 0 && (
              <Link href="/admin/schedule" className="block px-1 py-3">
                <ListRowContent
                  icon="📋"
                  title="ยังไม่กดยอมรับเงื่อนไข"
                  sub="ห้องพักที่กำลังจะมาถึง"
                  value={`${tasks.pendingConsent} คน →`}
                  valueClass="text-latte-deep"
                />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* เปิดตารางนัด (แยกหน้า) */}
      <Link
        href="/admin/schedule"
        className="flex items-center justify-between gap-3 rounded-catcha bg-card p-4 shadow-catcha-sm"
      >
        <ListRowContent
          icon="🗓️"
          title="ตารางนัด"
          sub={`วันนี้ ${stats.todayAppointments} นัด · รอยืนยัน ${stats.queue}`}
        />
        <span className="shrink-0 rounded-full bg-honey/40 px-4 py-2 text-xs font-extrabold text-catcha-chocolate">
          เปิดตาราง →
        </span>
      </Link>
    </div>
  );
}

function MiniStat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 px-2">
      <p className="text-[10px] font-bold text-brown-soft">{label}</p>
      <p className={`truncate text-base font-extrabold ${highlight ? "text-wait" : "text-catcha-chocolate"}`}>
        {value}
      </p>
      <p className="truncate text-[10px] text-brown-faint">{sub}</p>
    </div>
  );
}
