"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/components/Toast";
import { toJpegDataUrl } from "@/lib/image-convert";

type PackageKind = "uses" | "credit" | "nights";

type Offer = {
  id: string;
  name: string;
  kind: PackageKind;
  totalUses: number;
  price: number;
  /** เฉพาะ kind==="credit" — เครดิตที่ได้เพิ่มฟรี */
  creditBonus: number;
  description?: string;
  imageUrl?: string;
  active: boolean;
};

type Order = {
  id: string;
  customerId: string;
  customerName: string;
  name: string;
  kind: PackageKind;
  totalUses: number;
  price: number;
  creditBonus: number;
  status: "pending" | "paid" | "cancelled";
  slipUrl?: string;
  createdAt: string;
  paidAt?: string;
};

/** แถวคอร์สที่เปิดขาย — กดแก้ไขแล้วกลายเป็นฟอร์มอินไลน์ (ชื่อ/ครั้ง/ราคา/คำโปรย) */
function OfferRow({
  offer,
  patch,
  pickImage,
}: {
  offer: Offer;
  patch: (body: Record<string, unknown>, okMsg: string, key: string) => Promise<void>;
  pickImage: (file: File, onDone: (dataUrl: string) => void) => Promise<void>;
}) {
  const o = offer;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(o.name);
  const [uses, setUses] = useState(String(o.totalUses));
  const [price, setPrice] = useState(String(o.price));
  const [creditBonus, setCreditBonus] = useState(String(o.creditBonus));
  const [desc, setDesc] = useState(o.description || "");
  const [saving, setSaving] = useState(false);
  const isCredit = o.kind === "credit";
  const isNights = o.kind === "nights";
  const unitWord = isNights ? "คืน" : "ครั้ง";

  const startEdit = () => {
    setName(o.name);
    setUses(String(o.totalUses));
    setPrice(String(o.price));
    setCreditBonus(String(o.creditBonus));
    setDesc(o.description || "");
    setEditing(true);
  };

  const save = async () => {
    if (!name.trim() || (!isCredit && Math.round(Number(uses) || 0) <= 0)) {
      toast(isCredit ? "กรอกชื่อแพ็กเกจ" : `กรอกชื่อคอร์สและจำนวน${unitWord}`, "error");
      return;
    }
    setSaving(true);
    try {
      await patch(
        {
          action: "update_offer",
          offerId: o.id,
          name: name.trim(),
          totalUses: Math.round(Number(uses) || 0),
          price: Math.round(Number(price) || 0),
          creditBonus: Math.round(Number(creditBonus) || 0),
          description: desc.trim(),
        },
        isCredit ? "แก้ไขแพ็กเกจเครดิตแล้ว ✏️" : "แก้ไขคอร์สแล้ว ✏️",
        o.id
      );
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const field =
    "w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm";

  if (editing) {
    return (
      <li className="rounded-catcha-sm border border-latte/50 bg-paper/70 p-3">
        <p className="mb-2 text-[11px] font-extrabold text-catcha-chocolate">
          ✏️ {isCredit ? "แก้ไขแพ็กเกจเครดิต Member" : "แก้ไขคอร์ส"}
        </p>
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isCredit ? "ชื่อแพ็กเกจ" : "ชื่อคอร์ส"}
            className={field}
          />
          {isCredit ? (
            <>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="ลูกค้าจ่าย (บาท)"
                  className={field}
                />
                <input
                  type="number"
                  min={0}
                  value={creditBonus}
                  onChange={(e) => setCreditBonus(e.target.value)}
                  placeholder="ได้เพิ่มฟรี (บาท)"
                  className={field}
                />
              </div>
              <p className="text-[10px] font-bold text-ok">
                รวมเครดิตที่ลูกค้าจะได้:{" "}
                {(
                  Math.round(Number(price) || 0) + Math.round(Number(creditBonus) || 0)
                ).toLocaleString()}{" "}
                บาท
              </p>
            </>
          ) : (
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={uses}
                onChange={(e) => setUses(e.target.value)}
                placeholder={isNights ? "กี่คืน" : "กี่ครั้ง"}
                className={field}
              />
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="ราคา (บาท)"
                className={field}
              />
            </div>
          )}
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="คำโปรย (ถ้ามี)"
            className={field}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="flex-1 rounded-catcha-sm bg-paper py-2 text-xs font-bold text-brown-soft"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="flex-1 rounded-catcha-sm bg-latte-deep py-2 text-xs font-extrabold text-card disabled:opacity-40"
            >
              {saving ? "…" : "💾 บันทึก"}
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      className={`rounded-catcha-sm border px-3 py-2 ${
        o.active
          ? "border-catcha-line bg-paper/50"
          : "border-catcha-line bg-paper/30 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 gap-2">
          <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-catcha-sm bg-paper">
            {o.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={o.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-lg">
                📷
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                pickImage(f, (dataUrl) =>
                  patch(
                    { action: "set_offer_image", offerId: o.id, image: dataUrl },
                    "เปลี่ยนรูปแล้ว 📷",
                    o.id
                  )
                );
              }}
            />
          </label>
          <div className="min-w-0">
            <p className="text-xs font-bold text-brown">
              {o.name} {!o.active && "(ปิดขายอยู่)"}
            </p>
            <p className="text-[10px] text-brown-soft">
              {isCredit
                ? `💎 จ่าย ${o.price.toLocaleString()} รับเพิ่ม ${o.creditBonus.toLocaleString()} · รวม ${(
                    o.price + o.creditBonus
                  ).toLocaleString()} เครดิต`
                : `${o.totalUses} ${unitWord} · ${o.price.toLocaleString()} ฿`}
              {o.description ? ` · ${o.description}` : ""}
            </p>
            <p className="text-[10px] text-brown-faint">
              แตะรูปเพื่อ{o.imageUrl ? "เปลี่ยน" : "ใส่"}รูป
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={startEdit}
            className="text-[10px] font-bold text-latte-deep"
          >
            ✏️ แก้ไข
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                patch(
                  { action: "set_offer_active", offerId: o.id, active: !o.active },
                  o.active ? "ปิดขายแล้ว" : "เปิดขายแล้ว",
                  o.id
                )
              }
              className="text-[10px] font-bold text-latte-deep"
            >
              {o.active ? "ปิดขาย" : "เปิดขาย"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirm(`ลบ "${o.name}" ออกจากรายการขาย?`)) return;
                patch(
                  { action: "delete_offer", offerId: o.id },
                  "ลบออกจากรายการขายแล้ว",
                  o.id
                );
              }}
              className="text-[10px] font-bold text-wait"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * 🛍️ ขายคอร์สในแอป — ตั้งว่าจะขายอะไร + ยืนยันรับเงินจากออร์เดอร์ที่ลูกค้ากดซื้อ
 * กดยืนยันแล้วระบบจะเพิ่มคอร์สให้ลูกค้า + ลงรายรับให้อัตโนมัติ
 */
export default function AdminPackagesPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [zoomSlip, setZoomSlip] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<PackageKind>("uses");
  const [uses, setUses] = useState("");
  const [price, setPrice] = useState("");
  const [creditBonus, setCreditBonus] = useState("");
  const [desc, setDesc] = useState("");
  const [image, setImage] = useState("");

  /** ย่อรูปก่อนส่งเสมอ — รูปจากมือถือ 5MB ยิงขึ้นไปตรงๆ จะโดนตีกลับ */
  const pickImage = async (file: File, onDone: (dataUrl: string) => void) => {
    try {
      onDone(await toJpegDataUrl(file, 900));
    } catch {
      toast("อ่านรูปไม่ได้ ลองรูปอื่นนะคะ", "error");
    }
  };

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/package-shop");
      const d = r.ok ? await r.json() : {};
      setOffers(d.offers || []);
      setOrders(d.orders || []);
    } catch {
      /* ไม่ให้ค้างที่ "กำลังโหลด" ถ้า API พัง */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addOffer = async () => {
    const n = Math.round(Number(uses) || 0);
    const bonus = Math.round(Number(creditBonus) || 0);
    if (!name.trim() || (kind === "uses" && n <= 0)) {
      toast(
        kind === "credit"
          ? "กรอกชื่อแพ็กเกจ"
          : `กรอกชื่อคอร์สและจำนวน${kind === "nights" ? "คืน" : "ครั้ง"}`,
        "error"
      );
      return;
    }
    if (kind === "credit" && Math.round(Number(price) || 0) <= 0 && bonus <= 0) {
      toast("กรอกราคาที่จ่ายหรือโบนัสเครดิตอย่างน้อย 1 ช่อง", "error");
      return;
    }
    setBusy("add");
    try {
      const res = await fetch("/api/package-shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_offer",
          name: name.trim(),
          kind,
          totalUses: n,
          price: Math.round(Number(price) || 0),
          creditBonus: bonus,
          description: desc.trim() || undefined,
          image: image || undefined,
        }),
      });
      if (res.ok) {
        toast(
          kind === "credit"
            ? "เพิ่มแพ็กเกจเครดิตแล้ว — ลูกค้าเห็นในแอปทันที 💎"
            : "เพิ่มคอร์สที่ขายแล้ว — ลูกค้าเห็นในแอปทันที 🛍️",
          "success"
        );
        setName("");
        setUses("");
        setPrice("");
        setCreditBonus("");
        setDesc("");
        setImage("");
        load();
      } else {
        toast("เพิ่มไม่สำเร็จ", "error");
      }
    } finally {
      setBusy("");
    }
  };

  const patch = async (body: Record<string, unknown>, okMsg: string, key: string) => {
    setBusy(key);
    try {
      const res = await fetch("/api/package-shop", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        // เงินเข้าแล้วเสมอ — ถ้าส่งการ์ดไม่ได้ต้องบอกตรงๆ ไม่ใช่บอกว่าแจ้งแล้ว
        toast(
          d.notifyError ? `${okMsg} · ⚠️ ส่ง LINE ไม่ได้: ${d.notifyError}` : okMsg,
          d.notifyError ? "error" : "success"
        );
        load();
      } else if (d.error === "not_pending") {
        toast("ออร์เดอร์นี้ถูกจัดการไปแล้ว (อาจกดซ้ำ) — รีเฟรชให้แล้ว", "error");
        load();
      } else if (d.error === "no_column") {
        toast(
          "ยังบันทึกรูปไม่ได้ — ไปที่ ตั้งค่า แล้วกด 'อัปเดตฐานข้อมูล' ครั้งเดียว แล้วลองใหม่นะคะ",
          "error"
        );
      } else {
        toast("ไม่สำเร็จ", "error");
      }
    } finally {
      setBusy("");
    }
  };

  const pending = orders.filter((o) => o.status === "pending");
  const done = orders.filter((o) => o.status !== "pending");
  const field =
    "w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm";

  if (loading) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-extrabold text-catcha-chocolate">
        🛍️ ขายคอร์สในแอป
      </h1>

      {/* ── ออร์เดอร์รอยืนยัน ── */}
      <section className="mb-4 rounded-catcha bg-card p-4 shadow-catcha-sm">
        <h2 className="mb-1 text-sm font-extrabold text-catcha-chocolate">
          ⏳ รอยืนยันรับเงิน {pending.length > 0 && `(${pending.length})`}
        </h2>
        <p className="mb-3 text-[10px] text-brown-faint">
          กดยืนยันแล้วระบบจะเพิ่มคอร์สให้ลูกค้า + ลงรายรับ + แจ้งลูกค้าให้อัตโนมัติ
        </p>
        {pending.length === 0 ? (
          <p className="text-xs text-brown-soft">ยังไม่มีออร์เดอร์รอยืนยัน</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((o) => (
              <li
                key={o.id}
                className="rounded-catcha-sm border border-wait/40 bg-paper/60 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/customers?id=${o.customerId}`}
                      className="text-xs font-extrabold text-latte-deep underline"
                    >
                      👤 {o.customerName}
                    </Link>
                    <p className="text-xs font-bold text-brown">{o.name}</p>
                    <p className="text-[10px] text-brown-soft">
                      {o.kind === "credit"
                        ? `💎 รับเพิ่ม ${o.creditBonus.toLocaleString()} · รวม ${(
                            o.price + o.creditBonus
                          ).toLocaleString()} เครดิต`
                        : `${o.totalUses} ${o.kind === "nights" ? "คืน" : "ครั้ง"}`}{" "}
                      · {o.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-extrabold text-catcha-chocolate">
                    {o.price.toLocaleString()} ฿
                  </p>
                </div>

                {o.slipUrl ? (
                  <button
                    type="button"
                    onClick={() => setZoomSlip(o.slipUrl!)}
                    className="mt-2 block w-full rounded-catcha-sm bg-sage/15 py-1.5 text-[10px] font-bold text-ok"
                  >
                    🧾 ลูกค้าแนบสลิปแล้ว — แตะดูรูป
                  </button>
                ) : (
                  <p className="mt-2 rounded-catcha-sm bg-honey/20 px-2 py-1.5 text-[10px] font-bold text-wait">
                    ⏳ ยังไม่ได้แนบสลิป
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => {
                      if (
                        !confirm(
                          `ยืนยันว่าได้รับเงิน ${o.price.toLocaleString()} บาท จาก ${o.customerName}?\n` +
                            (o.kind === "credit"
                              ? `ระบบจะเติมเครดิต Member ${(
                                  o.price + o.creditBonus
                                ).toLocaleString()} บาท ให้ลูกค้าทันที`
                              : `ระบบจะเพิ่มคอร์ส "${o.name}" (${o.totalUses} ${o.kind === "nights" ? "คืน" : "ครั้ง"}) ให้ลูกค้าทันที`)
                        )
                      )
                        return;
                      patch(
                        { action: "confirm_order", orderId: o.id },
                        "ยืนยันรับเงินแล้ว — เพิ่มคอร์สให้ลูกค้าเรียบร้อย 🎫",
                        o.id
                      );
                    }}
                    className="rounded-full bg-sage/25 px-3 py-1.5 text-[11px] font-extrabold text-ok disabled:opacity-40"
                  >
                    {busy === o.id ? "…" : "✅ ได้รับเงินแล้ว"}
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => {
                      if (!confirm("ยกเลิกออร์เดอร์นี้? (ลูกค้าจะไม่ได้คอร์ส)")) return;
                      patch(
                        { action: "cancel_order", orderId: o.id },
                        "ยกเลิกออร์เดอร์แล้ว",
                        o.id
                      );
                    }}
                    className="rounded-full bg-wait/15 px-3 py-1.5 text-[11px] font-bold text-wait disabled:opacity-40"
                  >
                    ❌ ยกเลิก
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── ตั้งว่าจะขายอะไร ── */}
      <section className="mb-4 rounded-catcha bg-card p-4 shadow-catcha-sm">
        <h2 className="mb-1 text-sm font-extrabold text-catcha-chocolate">
          🏷️ คอร์สที่เปิดขายในแอป
        </h2>
        <p className="mb-3 text-[10px] text-brown-faint">
          ลูกค้าจะเห็นรายการนี้ในหน้าแรกของแอป และกดซื้อได้เลย
        </p>

        {offers.length > 0 && (
          <ul className="mb-3 space-y-2">
            {offers.map((o) => (
              <OfferRow key={o.id} offer={o} patch={patch} pickImage={pickImage} />
            ))}
          </ul>
        )}

        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind("uses")}
              className={`flex-1 rounded-catcha-sm py-2 text-xs font-extrabold ${
                kind === "uses" ? "bg-latte-deep text-card" : "bg-paper text-brown-soft"
              }`}
            >
              🎫 คอร์สนับครั้ง
            </button>
            <button
              type="button"
              onClick={() => setKind("credit")}
              className={`flex-1 rounded-catcha-sm py-2 text-xs font-extrabold ${
                kind === "credit" ? "bg-latte-deep text-card" : "bg-paper text-brown-soft"
              }`}
            >
              💎 เครดิต Member
            </button>
            <button
              type="button"
              onClick={() => setKind("nights")}
              className={`flex-1 rounded-catcha-sm py-2 text-xs font-extrabold ${
                kind === "nights" ? "bg-latte-deep text-card" : "bg-paper text-brown-soft"
              }`}
            >
              🏠 ซื้อวันเข้าพัก
            </button>
          </div>
          {kind === "nights" && (
            <p className="rounded-catcha-sm bg-honey/15 px-3 py-2 text-[11px] font-bold text-catcha-chocolate">
              ลูกค้าซื้อจำนวนคืนล่วงหน้าในราคาถูกกว่า แล้วหักตามคืนที่เข้าพักจริง
              <span className="mt-0.5 block font-normal text-brown-soft">
                คลุมเฉพาะค่าห้อง — ค่าอาบน้ำ/ของเสริมในบิลเดียวกันยังคิดตามปกติ · ไม่มีวันหมดอายุ
              </span>
            </p>
          )}

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              kind === "credit"
                ? "ชื่อแพ็กเกจ เช่น Member Package 10,000"
                : kind === "nights"
                  ? "ชื่อคอร์ส เช่น แพ็กรายเดือน 30 คืน (ลด 30%)"
                  : "ชื่อคอร์ส เช่น อาบน้ำ 10 ครั้ง"
            }
            className={field}
          />
          {kind === "credit" ? (
            <>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="ลูกค้าจ่าย (บาท)"
                  className={field}
                />
                <input
                  type="number"
                  min={0}
                  value={creditBonus}
                  onChange={(e) => setCreditBonus(e.target.value)}
                  placeholder="ได้เพิ่มฟรี (บาท)"
                  className={field}
                />
              </div>
              <p className="rounded-catcha-sm bg-sage/10 px-3 py-2 text-[11px] font-bold text-ok">
                รวมเครดิตที่ลูกค้าจะได้:{" "}
                {(
                  Math.round(Number(price) || 0) + Math.round(Number(creditBonus) || 0)
                ).toLocaleString()}{" "}
                บาท
              </p>
            </>
          ) : (
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                value={uses}
                onChange={(e) => setUses(e.target.value)}
                placeholder={kind === "nights" ? "กี่คืน" : "กี่ครั้ง"}
                className={field}
              />
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="ราคา (บาท)"
                className={field}
              />
            </div>
          )}
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="คำโปรย (ถ้ามี) เช่น ประหยัดกว่าซื้อแยก 500฿"
            className={field}
          />

          <label className="flex cursor-pointer items-center gap-3 rounded-catcha-sm border border-dashed border-catcha-line bg-paper px-3 py-2.5">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt="รูปหน้าปกคอร์ส"
                className="h-14 w-14 shrink-0 rounded-catcha-sm object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-catcha-sm bg-card text-xl">
                📷
              </span>
            )}
            <span className="min-w-0 text-[11px] font-bold text-brown-soft">
              {image ? "เปลี่ยนรูปหน้าปก" : "ใส่รูปหน้าปก (ถ้ามี)"}
              <span className="block font-normal text-brown-faint">
                รูปสวยๆ ช่วยให้ลูกค้ากดซื้อง่ายขึ้นเยอะเลยค่ะ
              </span>
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) pickImage(f, setImage);
              }}
            />
          </label>

          <button
            type="button"
            disabled={busy === "add"}
            onClick={addOffer}
            className="w-full rounded-catcha-sm bg-latte/30 py-2.5 text-sm font-extrabold text-catcha-chocolate disabled:opacity-40"
          >
            {busy === "add"
              ? "กำลังเพิ่ม…"
              : kind === "credit"
                ? "➕ เพิ่มแพ็กเกจเครดิตที่จะขาย"
                : "➕ เพิ่มคอร์สที่จะขาย"}
          </button>
        </div>
      </section>

      {/* ── ประวัติออร์เดอร์ ── */}
      {done.length > 0 && (
        <section className="rounded-catcha bg-card p-4 shadow-catcha-sm">
          <h2 className="mb-2 text-sm font-extrabold text-catcha-chocolate">
            📋 ออร์เดอร์ที่จบแล้ว
          </h2>
          <ul className="space-y-1">
            {done.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 rounded-catcha-sm bg-paper/50 px-2.5 py-1 text-[11px]"
              >
                <span className="min-w-0 truncate text-brown-soft">
                  {(o.paidAt || o.createdAt).slice(0, 10)} · {o.customerName} · {o.name}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={`font-bold ${o.status === "paid" ? "text-ok" : "text-wait"}`}
                  >
                    {o.status === "paid" ? `✅ ${o.price.toLocaleString()}฿` : "ยกเลิก"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm("ลบออร์เดอร์นี้ออกจากประวัติ? (ไม่กระทบคอร์สที่ลูกค้าได้ไปแล้ว)"))
                        return;
                      patch(
                        { action: "delete_order", orderId: o.id },
                        "ลบออกจากประวัติแล้ว",
                        o.id
                      );
                    }}
                    className="text-[11px] text-brown-faint hover:text-wait"
                    aria-label="ลบออร์เดอร์นี้"
                  >
                    🗑️
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ดูสลิปเต็มจอ */}
      {zoomSlip && (
        <button
          type="button"
          onClick={() => setZoomSlip(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomSlip}
            alt="สลิปโอนเงิน"
            className="max-h-full max-w-full rounded-catcha object-contain"
          />
        </button>
      )}
    </div>
  );
}
