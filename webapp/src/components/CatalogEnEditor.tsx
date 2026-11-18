"use client";

import { useState } from "react";

type Entry = { th: string; en: string; manual?: boolean; kind: string };

/**
 * หลังบ้าน: ชื่อภาษาอังกฤษของโปร/คอร์ส/แพ็กเกจ ที่ลูกค้า English เห็น
 * ระบบแปลให้อัตโนมัติแล้ว — ร้านตรวจ/แก้ได้ที่นี่ · ลบคำแปลออก (เว้นว่าง) = ให้ระบบแปลใหม่
 */
export function CatalogEnEditor() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (entries || loading) return;
    setLoading(true);
    try {
      const r = await fetch("/api/i18n/catalog?list=1", { cache: "no-store" });
      const d = await r.json();
      setEntries(d.entries || []);
    } catch {
      setMsg("โหลดไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  const changed = Object.entries(draft).filter(([th, en]) => (entries?.find((e) => e.th === th)?.en || "") !== en);

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const r = await fetch("/api/i18n/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits: changed.map(([th, en]) => ({ th, en })) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setEntries(d.entries || []);
      setDraft({});
      setMsg("บันทึกแล้ว");
    } catch {
      setMsg("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  return (
    <details
      className="mt-6 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm"
      onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && load()}
    >
      <summary className="cursor-pointer list-none text-sm font-extrabold text-catcha-chocolate">
        🇬🇧 ชื่อภาษาอังกฤษ (โปร · คอร์ส · แพ็กเกจ)
        <span className="mt-0.5 block text-[11px] font-bold text-brown-faint">
          ลูกค้าที่ใช้ภาษาอังกฤษเห็นชื่อพวกนี้ · ระบบแปลให้อัตโนมัติ แตะเพื่อตรวจ/แก้
        </span>
      </summary>
      {loading && <p className="mt-3 text-xs text-brown-soft">กำลังโหลดและแปลที่ยังขาด…</p>}
      {entries && entries.length === 0 && <p className="mt-3 text-xs text-brown-soft">ยังไม่มีโปรหรือคอร์สที่เป็นภาษาไทย</p>}
      {entries && entries.length > 0 && (
        <div className="mt-3 space-y-3">
          {entries.map((e) => (
            <label key={e.th} className="block text-xs">
              <span className="block font-bold text-brown">
                {e.th}
                <span className="ml-1 font-normal text-brown-faint">
                  · {e.kind}
                  {e.manual ? " · แก้เอง" : e.en ? " · แปลอัตโนมัติ" : " · ยังไม่มีคำแปล"}
                </span>
              </span>
              <textarea
                value={draft[e.th] ?? e.en}
                onChange={(ev) => setDraft((d) => ({ ...d, [e.th]: ev.target.value }))}
                rows={e.th.length > 60 ? 3 : 1}
                placeholder="English"
                className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm text-brown"
              />
            </label>
          ))}
          <button
            type="button"
            disabled={saving || changed.length === 0}
            onClick={save}
            className="flex min-h-[44px] w-full items-center justify-center rounded-catcha-sm bg-latte-deep px-4 text-sm font-extrabold text-card disabled:opacity-50"
          >
            {saving ? "กำลังบันทึก…" : changed.length ? `บันทึก (${changed.length})` : "บันทึก"}
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-xs font-bold text-brown-soft">{msg}</p>}
    </details>
  );
}
