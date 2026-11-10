"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type Status = { ready: boolean; message: string; from?: string; to?: string; schema?: string };
type Row = { table: string; source: number; target: number };

async function post<T>(body: unknown): Promise<T> {
  const res = await fetch("/api/admin/move-db", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

/**
 * ย้ายฐานข้อมูลไปห้องของร้านในโปรเจกต์ Supabase อื่น (เช่นโปรเจกต์เดียวกับ PetFlow เพื่อลดค่าใช้จ่าย)
 * แสดงเฉพาะเมื่อตั้ง MOVE_TO_* ใน Vercel แล้ว — ร้านทั่วไปไม่เห็นส่วนนี้
 */
export function MoveDbSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [files, setFiles] = useState<{ total: number; copied: number; failed: string[] } | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/admin/move-db", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status) {
          setStatus(d.status);
          setTables(d.tables || []);
        }
      })
      .catch(() => {});
  }, []);

  // ยังไม่ได้ตั้งค่าย้าย (ร้านทั่วไป) = ไม่ต้องโชว์อะไร
  if (!status || /ยังไม่ได้ตั้ง MOVE_TO/.test(status.message)) return null;

  const run = async () => {
    setRunning(true);
    setError("");
    setDone(false);
    setRows([]);
    setFiles(null);
    try {
      setStep("เตรียมห้องในฐานใหม่…");
      await post({ step: "prepare" });
      const out: Row[] = [];
      for (const t of tables) {
        setStep(`คัดลอก ${t}…`);
        const r = await post<Row>({ step: "table", table: t });
        out.push(r);
        setRows([...out]);
      }
      let offset = 0;
      let copied = 0;
      const failed: string[] = [];
      for (;;) {
        setStep(`คัดลอกรูป… (${offset})`);
        const r = await post<{ total: number; offset: number; copied: number; failed: string[]; done: boolean }>({
          step: "files",
          offset,
        });
        copied += r.copied;
        failed.push(...r.failed);
        offset = r.offset;
        setFiles({ total: r.total, copied, failed: [...failed] });
        if (r.done) break;
      }
      setDone(true);
      setStep("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep("");
    }
    setRunning(false);
  };

  const mismatched = rows.filter((r) => r.source !== r.target);

  return (
    <section className="mb-4 space-y-3 rounded-catcha border border-honey/50 bg-honey/10 p-4">
      <div>
        <p className="font-extrabold text-catcha-chocolate">ย้ายฐานข้อมูล</p>
        <p className="mt-0.5 text-xs text-brown-soft">{status.message}</p>
      </div>

      {status.ready && (
        <>
          <p className="text-xs text-brown">
            คัดลอกข้อมูลและรูปทั้งหมดไปฐานใหม่ เว็บยังใช้ฐานเดิมตามปกติ ฐานเดิมไม่ถูกแก้ กดซ้ำได้
          </p>
          <button
            type="button"
            onClick={run}
            disabled={running}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-catcha-chocolate px-4 text-sm font-extrabold text-card disabled:opacity-40"
          >
            <Icon name="copy" size={18} />
            {running ? step || "กำลังคัดลอก…" : "คัดลอกข้อมูลไปฐานใหม่"}
          </button>
        </>
      )}

      {error && <p className="rounded-catcha-sm bg-card px-3 py-2 text-xs font-bold text-red-700">{error}</p>}

      {rows.length > 0 && (
        <div className="max-h-64 overflow-auto rounded-catcha-sm bg-card p-2 text-xs">
          <table className="w-full">
            <thead>
              <tr className="text-left text-brown-soft">
                <th className="py-1">ตาราง</th>
                <th className="py-1 text-right">ฐานเดิม</th>
                <th className="py-1 text-right">ฐานใหม่</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.table} className={r.source === r.target ? "text-brown" : "font-bold text-red-700"}>
                  <td className="py-0.5">{r.table}</td>
                  <td className="py-0.5 text-right">{r.source}</td>
                  <td className="py-0.5 text-right">{r.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {files && (
        <p className="text-xs text-brown">
          รูป: คัดลอกแล้ว {files.copied}/{files.total}
          {files.failed.length > 0 && (
            <span className="font-bold text-red-700"> · ไม่สำเร็จ {files.failed.length} ไฟล์ (กดซ้ำได้)</span>
          )}
        </p>
      )}

      {done && (
        <p className="rounded-catcha-sm bg-sage/20 px-3 py-2 text-xs font-bold text-ok">
          {mismatched.length === 0 && (files?.failed.length ?? 0) === 0
            ? "คัดลอกครบ จำนวนตรงกันทุกตาราง — พร้อมสลับไปใช้ฐานใหม่"
            : `เสร็จ แต่มี ${mismatched.length} ตารางจำนวนไม่ตรง — กดซ้ำอีกครั้ง`}
        </p>
      )}
    </section>
  );
}
