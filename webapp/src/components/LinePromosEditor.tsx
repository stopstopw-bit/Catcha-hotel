"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { toast } from "@/components/Toast";
import { LINE_PROMO_KINDS, isFreeNightsPromo, type LinePromo } from "@/lib/line-discount";

/**
 * โปรตอนออกบิล (config.linePromos) — ลด % เฉพาะประเภทรายการ หรือแถมคืนฟรี
 * ตั้งที่หน้าโปรโมชั่น แล้วพนักงานกดเลือกตอนออกบิล
 */
export function LinePromosEditor({
  addRequest,
}: {
  /** กด "เพิ่มโปร" แบบนี้จากที่อื่นในหน้า (seq เปลี่ยน = เพิ่มอีกอัน) */
  addRequest?: { mode: "percent" | "free"; seq: number };
}) {
  const [list, setList] = useState<LinePromo[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      // แถวที่กดเพิ่มไว้ก่อนโหลดเสร็จ (มาจากฟอร์มเพิ่มโปร) ต่อท้ายของเดิม ไม่หาย
      .then((d) => setList((prev) => [...(d.config?.linePromos || []), ...prev]))
      .catch(() => {});
  }, []);
  const update = (i: number, patch: Partial<LinePromo>) =>
    setList((prev) => prev.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  const add = (mode: "percent" | "free") =>
    setList((prev) => [
      ...prev,
      mode === "free"
        ? { id: `lp${Date.now().toString(36)}`, name: "", percent: 0, kinds: ["stay"], freeEvery: 10, freeNights: 1 }
        : { id: `lp${Date.now().toString(36)}`, name: "", percent: 5, kinds: ["stay", "grooming"] },
    ]);
  const seq = addRequest?.seq;
  const handledSeq = useRef(0); // กันเพิ่มซ้ำตอน effect รันสองรอบ
  useEffect(() => {
    if (!seq || !addRequest || handledSeq.current === seq) return;
    handledSeq.current = seq;
    add(addRequest.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);
  const onSave = async (patch: { linePromos: LinePromo[] }) => {
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch }),
      });
      if (res.ok) {
        setList(patch.linePromos);
        toast("บันทึกโปรตอนออกบิลแล้ว", "success");
      } else toast("บันทึกไม่สำเร็จ", "error");
    } catch {
      toast("บันทึกไม่สำเร็จ", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          linePromos: list
            .map((p) => ({
              ...p,
              name: p.name.replace(/[()]/g, "").trim(),
              percent: Math.min(100, Math.max(0, Math.round(Number(p.percent) || 0))),
              minNights: Math.max(0, Math.round(Number(p.minNights) || 0)) || undefined,
              freeEvery: Math.max(0, Math.round(Number(p.freeEvery) || 0)) || undefined,
              freeNights: Math.max(0, Math.round(Number(p.freeNights) || 0)) || undefined,
            }))
            // แบบแถมคืนฟรีใช้กับห้องพักเท่านั้น ไม่ต้องมี % / ประเภท
            .map((p) => (isFreeNightsPromo(p) ? { ...p, percent: 0, kinds: ["stay" as const] } : p))
            .filter((p) => p.name && (isFreeNightsPromo(p) || (p.percent > 0 && p.kinds.length > 0))),
        });
      }}
    >
      <p className="rounded-catcha-sm bg-paper px-3 py-2 text-[11px] text-brown-soft">
        ตั้งโปรไว้ แล้วตอนออกบิลกดเลือกได้เลย — ลดเฉพาะรายการประเภทที่ติ๊กไว้
        (เช่น ลดห้องพักกับอาบน้ำ แต่ค่ารับ-ส่งไม่ลด) บิลจะเขียนบอกส่วนลดทีละรายการ
      </p>
      {list.map((p, i) => {
        const free = p.freeEvery !== undefined;
        const modeChip = (on: boolean) =>
          `min-h-[32px] rounded-full px-3 text-[11px] font-bold ${
            on ? "bg-catcha-chocolate text-card" : "bg-paper text-brown-soft"
          }`;
        const num =
          "min-h-[36px] w-14 rounded-catcha-sm border border-catcha-line bg-paper px-2 text-right text-sm font-bold";
        return (
          <div key={p.id} className="space-y-2 rounded-catcha-sm border border-catcha-line p-3">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => update(i, { freeEvery: undefined, freeNights: undefined })}
                className={modeChip(!free)}
              >
                ลด %
              </button>
              <button
                type="button"
                onClick={() => update(i, { freeEvery: p.freeEvery || 10, freeNights: p.freeNights || 1 })}
                className={modeChip(free)}
              >
                แถมคืนฟรี
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={p.name}
                onChange={(e) => update(i, { name: e.target.value })}
                placeholder={free ? "ชื่อโปร เช่น พักยาวแถมฟรี" : "ชื่อโปร เช่น ลูกค้าประจำ"}
                className="min-h-[40px] min-w-0 flex-1 rounded-catcha-sm border border-catcha-line bg-paper px-3 text-sm"
              />
              {!free && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    inputMode="numeric"
                    value={p.percent || ""}
                    onChange={(e) => update(i, { percent: Number(e.target.value) })}
                    className="min-h-[40px] w-16 rounded-catcha-sm border border-catcha-line bg-paper px-2 text-right text-sm font-bold"
                  />
                  <span className="text-sm font-bold text-brown-soft">%</span>
                </div>
              )}
            </div>
            {free ? (
              <div className="space-y-1">
                <label className="flex flex-wrap items-center gap-2 text-xs font-bold text-brown-soft">
                  จอง
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={p.freeEvery || ""}
                    onChange={(e) => update(i, { freeEvery: Number(e.target.value) || 0 })}
                    className={num}
                  />
                  คืน แถมฟรี
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={p.freeNights || ""}
                    onChange={(e) => update(i, { freeNights: Number(e.target.value) || 0 })}
                    className={num}
                  />
                  คืน
                </label>
                {isFreeNightsPromo(p) && (
                  <p className="text-[11px] text-brown-faint">
                    พักครบ {p.freeEvery! + p.freeNights!} คืน จ่าย {p.freeEvery} คืน · พัก{" "}
                    {(p.freeEvery! + p.freeNights!) * 2} คืน แถม {p.freeNights! * 2} · ลดเฉพาะค่าห้องพัก
                  </p>
                )}
              </div>
            ) : (
              <>
              <div className="flex flex-wrap gap-1.5">
                {LINE_PROMO_KINDS.map((k) => {
                  const on = p.kinds.includes(k.id);
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() =>
                        update(i, {
                          kinds: on ? p.kinds.filter((x) => x !== k.id) : [...p.kinds, k.id],
                        })
                      }
                      className={`min-h-[34px] rounded-full border px-3 text-xs font-bold ${
                        on
                          ? "border-catcha-chocolate bg-catcha-chocolate text-card"
                          : "border-catcha-line bg-card text-brown-soft"
                      }`}
                    >
                      {on ? "✓ " : ""}
                      {k.label}
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-brown-soft">
                ใช้ได้เมื่อพักตั้งแต่
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={p.minNights || ""}
                  onChange={(e) => update(i, { minNights: Number(e.target.value) || undefined })}
                  placeholder="—"
                  className="min-h-[36px] w-16 rounded-catcha-sm border border-catcha-line bg-paper px-2 text-right text-sm font-bold"
                />
                คืน
                <span className="font-normal text-brown-faint">(เว้นว่าง = ทุกบิล)</span>
              </label>
              </>
            )}
            <button
              type="button"
              onClick={() => setList((prev) => prev.filter((_, k) => k !== i))}
              className="text-[11px] font-bold text-wait"
            >
              ลบโปรนี้
            </button>
          </div>
        );
      })}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => add("percent")}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full border border-dashed border-catcha-line text-xs font-bold text-brown"
        >
          <Icon name="plus" size={16} />
          ลด %
        </button>
        <button
          type="button"
          onClick={() => add("free")}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full border border-dashed border-catcha-line text-xs font-bold text-brown"
        >
          <Icon name="plus" size={16} />
          แถมคืนฟรี
        </button>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-catcha-chocolate text-sm font-extrabold text-card shadow-catcha-sm disabled:opacity-50"
      >
        <Icon name="check" size={18} strokeWidth={2.2} />
        {saving ? "กำลังบันทึก…" : "บันทึกโปรตอนออกบิล"}
      </button>
    </form>
  );
}

