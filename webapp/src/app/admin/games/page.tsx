"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/Toast";
import { Icon } from "@/components/Icon";
import { EmptyState, MoreMenu, SectionLabel, Segmented } from "@/components/ui";
import { TIER_LABELS } from "@/lib/customer-tier";
import {
  GAME_TYPE_LABEL,
  defaultGameCampaign,
  gameStatus,
  newGameId,
  prizeChances,
  type GameCampaign,
  type GamePrize,
  type GameStats,
  type GameType,
} from "@/lib/game-types";

type Data = {
  games: GameCampaign[];
  stats: Record<string, GameStats>;
  links: Record<string, string>;
  liffReady: boolean;
};

const field = "w-full min-w-0 rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm";
const TIERS = ["all", "new", "regular", "member", "vip"] as const;

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

const STATUS_LABEL: Record<string, { text: string; tone: string }> = {
  open: { text: "เปิดเล่นอยู่", tone: "bg-sage/25 text-ok" },
  not_started: { text: "ยังไม่ถึงวันเริ่ม", tone: "bg-honey/30 text-latte-deep" },
  ended: { text: "จบแล้ว", tone: "bg-paper text-brown-faint" },
  closed: { text: "ปิดอยู่", tone: "bg-paper text-brown-soft" },
};

// ── ฟอร์มแก้เกม (แผ่นเลื่อนขึ้น) ─────────────────────────

function GameEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: GameCampaign;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [g, setG] = useState<GameCampaign>(initial);
  const [saving, setSaving] = useState(false);
  const chances = prizeChances(g.prizes);
  const set = (patch: Partial<GameCampaign>) => setG((x) => ({ ...x, ...patch }));
  const setPrize = (id: string, patch: Partial<GamePrize>) =>
    setG((x) => ({ ...x, prizes: x.prizes.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: g }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return toast(d.error || "บันทึกไม่สำเร็จ", "error");
      toast("บันทึกเกมแล้ว", "success");
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-catcha bg-cream p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-catcha"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">
              {g.type === "wheel" ? "Lucky Wheel" : "Scratch & Win"}
            </p>
            <h2 className="text-lg font-extrabold text-catcha-chocolate">{GAME_TYPE_LABEL[g.type]}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="ปิด" className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-catcha-sm">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
          <Segmented<GameType>
            value={g.type}
            onChange={(type) => set({ type })}
            options={[
              { id: "wheel", label: "วงล้อ" },
              { id: "scratch", label: "ขูดบัตร" },
            ]}
          />
          <input value={g.title} onChange={(e) => set({ title: e.target.value })} placeholder="ชื่อเกม เช่น หมุนวงล้อ ลุ้นส่วนลดปีใหม่" className={field} />
          <input value={g.subtitle || ""} onChange={(e) => set({ subtitle: e.target.value })} placeholder="คำโปรย (ไม่บังคับ)" className={field} />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-brown-soft">
              เริ่ม (ไม่ใส่ = ทันที)
              <input type="date" value={g.startDate || ""} onChange={(e) => set({ startDate: e.target.value || undefined })} className={`${field} mt-1`} />
            </label>
            <label className="text-xs text-brown-soft">
              จบ (ไม่ใส่ = ไม่มีวันจบ)
              <input type="date" value={g.endDate || ""} onChange={(e) => set({ endDate: e.target.value || undefined })} className={`${field} mt-1`} />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-brown">เล่นได้</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={g.playsPerCustomer}
              onChange={(e) => set({ playsPerCustomer: Number(e.target.value) || 1 })}
              className={`${field} w-16 text-center`}
            />
            <span className="shrink-0 text-sm text-brown">ครั้ง</span>
            <Segmented<"campaign" | "day">
              value={g.period}
              onChange={(period) => set({ period })}
              className="flex-1"
              options={[
                { id: "campaign", label: "ต่อคน" },
                { id: "day", label: "ต่อคน/วัน" },
              ]}
            />
          </div>
          <p className="text-[11px] text-brown-soft">เล่นได้เฉพาะลูกค้าที่สมัครสมาชิกแล้ว — คนที่ยังไม่สมัครจะเห็นปุ่มสมัครฟรีก่อนเล่น</p>
        </div>

        <SectionLabel>
          <span className="mt-4 block">Prizes · รางวัล (คิดโอกาสเป็น % ให้อัตโนมัติ)</span>
        </SectionLabel>
        <div className="space-y-2">
          {g.prizes.map((p) => (
            <div key={p.id} className="space-y-2 rounded-catcha-sm bg-card p-3 shadow-catcha-sm">
              <div className="flex gap-2">
                <input value={p.label} onChange={(e) => setPrize(p.id, { label: e.target.value })} placeholder="ข้อความบนช่อง" className={`${field} flex-1`} />
                <button
                  type="button"
                  aria-label="ลบรางวัลนี้"
                  disabled={g.prizes.length <= 2}
                  onClick={() => set({ prizes: g.prizes.filter((x) => x.id !== p.id) })}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-brown-soft disabled:opacity-30"
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={p.kind}
                  onChange={(e) => setPrize(p.id, { kind: e.target.value as GamePrize["kind"] })}
                  className={field}
                >
                  <option value="coupon">คูปองส่วนลด (บาท)</option>
                  <option value="points">แต้มสะสม</option>
                  <option value="none">ไม่ได้รางวัล</option>
                </select>
                {p.kind !== "none" && (
                  <label className="flex w-32 items-center gap-1 rounded-catcha-sm border border-catcha-line bg-paper px-3">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={p.amount || ""}
                      onChange={(e) => setPrize(p.id, { amount: Number(e.target.value) || 0 })}
                      className="h-10 w-full min-w-0 bg-transparent text-sm outline-none"
                    />
                    <span className="shrink-0 text-xs text-brown-soft">{p.kind === "coupon" ? "บาท" : "แต้ม"}</span>
                  </label>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-brown-soft">
                <label className="flex items-center gap-1">
                  โอกาส
                  <input
                    type="number"
                    inputMode="decimal"
                    value={p.weight}
                    onChange={(e) => setPrize(p.id, { weight: Number(e.target.value) || 0 })}
                    className="h-9 w-16 rounded-lg border border-catcha-line bg-paper px-2 text-center text-sm text-brown"
                  />
                  <span className="font-bold text-latte-deep">= {chances[p.id].toFixed(1)}%</span>
                </label>
                {p.kind !== "none" && (
                  <label className="flex items-center gap-1">
                    แจกสูงสุด
                    <input
                      type="number"
                      inputMode="numeric"
                      value={p.stock || ""}
                      placeholder="ไม่จำกัด"
                      onChange={(e) => setPrize(p.id, { stock: Number(e.target.value) || undefined })}
                      className="h-9 w-20 rounded-lg border border-catcha-line bg-paper px-2 text-center text-sm text-brown"
                    />
                  </label>
                )}
                {p.kind === "coupon" && (
                  <label className="flex items-center gap-1">
                    ใช้ได้
                    <input
                      type="number"
                      inputMode="numeric"
                      value={p.validDays || ""}
                      placeholder="30"
                      onChange={(e) => setPrize(p.id, { validDays: Number(e.target.value) || undefined })}
                      className="h-9 w-14 rounded-lg border border-catcha-line bg-paper px-2 text-center text-sm text-brown"
                    />
                    วัน
                  </label>
                )}
              </div>
            </div>
          ))}
          {g.prizes.length < 12 && (
            <button
              type="button"
              onClick={() =>
                set({ prizes: [...g.prizes, { id: newGameId("P"), label: "", kind: "coupon", amount: 0, weight: 0, validDays: 30 }] })
              }
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-catcha-sm border border-dashed border-latte bg-card/60 text-sm font-bold text-latte-deep"
            >
              <Icon name="plus" size={16} /> เพิ่มรางวัล
            </button>
          )}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="mt-4 h-12 w-full rounded-full bg-catcha-chocolate text-sm font-extrabold text-card disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก…" : "บันทึกเกม"}
        </button>
      </div>
    </div>
  );
}

// ── QR / ลิงก์ ───────────────────────────────────────────

function QrSheet({ game, link, onClose }: { game: GameCampaign; link: string; onClose: () => void }) {
  const [qr, setQr] = useState("");
  useEffect(() => {
    if (!link) return;
    import("qrcode")
      .then((m) => m.default.toDataURL(link, { margin: 1, width: 720, color: { dark: "#5c4033", light: "#ffffff" } }))
      .then(setQr)
      .catch(() => setQr(""));
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast("คัดลอกลิงก์แล้ว", "success");
    } catch {
      toast("คัดลอกไม่ได้ กดค้างที่ลิงก์เพื่อคัดลอกเองนะคะ", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-t-catcha bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-center sm:rounded-catcha"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">QR · ติดหน้าร้าน</p>
        <h2 className="text-lg font-extrabold text-catcha-chocolate">{game.title}</h2>
        {link ? (
          <>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR เข้าเกม" className="mx-auto mt-3 w-56 rounded-xl border border-catcha-line" />
            ) : (
              <div className="mx-auto mt-3 h-56 w-56 animate-pulse rounded-xl bg-paper" />
            )}
            <p className="mt-2 text-xs text-brown-soft">ลูกค้าสแกนด้วยกล้องหรือ LINE → เปิดเกมใน LINE ของร้าน</p>
            <p className="mt-2 break-all rounded-lg bg-paper px-2 py-1.5 text-[11px] text-brown">{link}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={copy} className="h-11 rounded-full bg-paper text-sm font-bold text-catcha-chocolate">
                คัดลอกลิงก์
              </button>
              <a
                href={qr || undefined}
                download={`qr-${game.id}.png`}
                className={`flex h-11 items-center justify-center rounded-full bg-catcha-chocolate text-sm font-extrabold text-card ${qr ? "" : "pointer-events-none opacity-50"}`}
              >
                บันทึกรูป QR
              </a>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-brown-soft">ยังไม่ได้ตั้ง LIFF ID — ไปที่เมนูติดตั้งก่อนนะคะ</p>
        )}
      </div>
    </div>
  );
}

// ── หน้าเมนู ─────────────────────────────────────────────

export default function AdminGamesPage() {
  const [data, setData] = useState<Data | null>(null);
  const [editing, setEditing] = useState<GameCampaign | null>(null);
  const [qrFor, setQrFor] = useState<GameCampaign | null>(null);
  const [recentFor, setRecentFor] = useState<string>("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/games", { cache: "no-store" });
      setData(r.ok ? await r.json() : { games: [], stats: {}, links: {}, liffReady: false });
    } catch {
      setData({ games: [], stats: {}, links: {}, liffReady: false });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/games", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) toast(d.error || "ไม่สำเร็จ", "error");
    return { ok: res.ok, d };
  };

  const toggle = async (g: GameCampaign) => {
    setBusy(g.id);
    await patch({ action: "set_active", gameId: g.id, active: !g.active });
    setBusy("");
    load();
  };

  const remove = async (g: GameCampaign) => {
    if (!confirm(`ลบเกม "${g.title}"? (คูปองที่ลูกค้าได้ไปแล้วยังใช้ได้ตามปกติ)`)) return;
    await patch({ action: "delete", gameId: g.id });
    load();
  };

  const blast = async (g: GameCampaign, tier: string) => {
    const who = tier === "all" ? "ลูกค้าทุกคน" : TIER_LABELS[tier as keyof typeof TIER_LABELS];
    if (!confirm(`ส่งการ์ดชวนเล่น "${g.title}" ทาง LINE ไปหา${who}? (เฉพาะคนที่ยินยอมรับข่าวสาร)`)) return;
    setBusy(g.id);
    const { ok, d } = await patch({ action: "blast", gameId: g.id, tier });
    setBusy("");
    if (ok) toast(`ส่งการ์ดแล้ว ${d.sent} คน`, "success");
  };

  if (!data) return <div className="py-16 text-center text-sm text-brown-soft">กำลังโหลด…</div>;
  const now = today();

  return (
    <div className="pb-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Games</p>
          <h1 className="text-xl font-extrabold text-catcha-chocolate">เกมลุ้นรางวัล</h1>
          <p className="mt-0.5 text-xs text-brown-soft">วงล้อ / ขูดบัตร ใน LINE — ลูกค้าต้องสมัครสมาชิกก่อนเล่น รางวัลเข้ากระเป๋าคูปองทันที</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(defaultGameCampaign("wheel"))}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-catcha-chocolate px-4 text-sm font-bold text-card shadow-catcha-sm"
        >
          <Icon name="plus" size={18} /> สร้าง
        </button>
      </div>

      {data.games.length === 0 ? (
        <div className="rounded-catcha bg-card shadow-catcha-sm">
          <EmptyState icon="gift" title="ยังไม่มีเกม" sub="กด “สร้าง” แล้วเลือกวงล้อหรือขูดบัตร ตั้งรางวัลเป็นคูปองส่วนลดได้เลย" />
        </div>
      ) : (
        <div className="space-y-3">
          {data.games.map((g) => {
            const st = data.stats[g.id];
            const status = STATUS_LABEL[gameStatus(g, now)];
            const chances = prizeChances(g.prizes);
            return (
              <div key={g.id} className="rounded-catcha bg-card p-4 shadow-catcha-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-honey/35 text-xl">
                    {g.type === "wheel" ? "🎡" : "🎟️"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-brown-soft">{GAME_TYPE_LABEL[g.type]}</p>
                    <p className="font-extrabold leading-tight text-catcha-chocolate">{g.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className={`rounded-full px-2 py-0.5 font-bold ${status.tone}`}>{status.text}</span>
                      <span className="text-brown-soft">
                        {g.period === "day" ? `วันละ ${g.playsPerCustomer} ครั้ง` : `${g.playsPerCustomer} ครั้ง/คน`}
                        {g.endDate ? ` · ถึง ${g.endDate.split("-").reverse().join("/")}` : ""}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={g.active}
                    aria-label={g.active ? "ปิดเกม" : "เปิดเกม"}
                    disabled={busy === g.id}
                    onClick={() => toggle(g)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${g.active ? "bg-ok" : "bg-brown-faint/60"}`}
                  >
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-card shadow transition ${g.active ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
                  {[
                    ["เล่น", st?.plays ?? 0],
                    ["ผู้เล่น", st?.players ?? 0],
                    ["สมาชิกใหม่", st?.newMembers ?? 0],
                    ["คูปองถูกใช้", `${st?.couponsUsed ?? 0}/${st?.couponsIssued ?? 0}`],
                  ].map(([label, v]) => (
                    <div key={label as string} className="rounded-catcha-sm bg-paper px-1 py-2">
                      <p className="text-base font-extrabold text-catcha-chocolate">{v}</p>
                      <p className="text-[10px] text-brown-soft">{label}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {g.prizes.map((p) => (
                    <span key={p.id} className="rounded-full bg-paper px-2.5 py-1 text-[11px] text-brown">
                      {p.label} <span className="text-brown-soft">{chances[p.id].toFixed(0)}%</span>
                      {st?.perPrize[p.id] ? <b className="ml-1 text-latte-deep">×{st.perPrize[p.id]}</b> : null}
                      {p.stock ? <span className="text-brown-faint"> /{p.stock}</span> : null}
                    </span>
                  ))}
                </div>

                {recentFor === g.id && (
                  <div className="mt-3 rounded-catcha-sm bg-paper p-2">
                    {st?.recent.length ? (
                      st.recent.map((r, i) => (
                        <div key={i} className="flex justify-between gap-2 px-1 py-1 text-xs">
                          <span className="truncate text-brown">{r.customerName}</span>
                          <span className={r.kind === "none" ? "text-brown-faint" : "font-bold text-latte-deep"}>{r.prize}</span>
                        </div>
                      ))
                    ) : (
                      <p className="py-2 text-center text-xs text-brown-soft">ยังไม่มีคนเล่น</p>
                    )}
                    {st && st.valueUsed > 0 && (
                      <p className="mt-1 border-t border-catcha-line px-1 pt-1.5 text-[11px] text-brown-soft">
                        ส่วนลดจากเกมที่ถูกใช้แล้วรวม ฿{st.valueUsed.toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQrFor(g)}
                    className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-catcha-chocolate text-sm font-extrabold text-card"
                  >
                    <Icon name="qr" size={16} /> QR / ลิงก์
                  </button>
                  <MoreMenu
                    items={[
                      { label: "แก้ไขเกม", icon: "edit", onClick: () => setEditing(g) },
                      {
                        label: recentFor === g.id ? "ซ่อนผู้เล่นล่าสุด" : "ดูผู้เล่นล่าสุด",
                        icon: "users",
                        onClick: () => setRecentFor((x) => (x === g.id ? "" : g.id)),
                      },
                      ...TIERS.map((t) => ({
                        label: `ส่งการ์ดชวนเล่น → ${t === "all" ? "ลูกค้าทุกคน" : TIER_LABELS[t]}`,
                        icon: "send",
                        disabled: !g.active || busy === g.id,
                        onClick: () => blast(g, t),
                      })),
                      { label: "ลบเกม", icon: "trash", danger: true, onClick: () => remove(g) },
                    ]}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <GameEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {qrFor && <QrSheet game={qrFor} link={data.links[qrFor.id] || ""} onClose={() => setQrFor(null)} />}
    </div>
  );
}
