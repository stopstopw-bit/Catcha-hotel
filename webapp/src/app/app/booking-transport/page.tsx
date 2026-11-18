"use client";

import { savedPopup } from "@/components/Toast";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";
import { formatThaiDateShort } from "@/lib/format-thai-date";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BTN_PRIMARY, PageHeader } from "@/components/PageHeader";
import { EmptyState, SectionLabel } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ReviewSheet } from "@/components/ReviewSheet";
import { useL } from "@/components/LocaleProvider";
import { dateFor } from "@/lib/locale-date";

type Bk = {
  id: string;
  catName: string;
  service: string;
  date?: string;
  time?: string;
  checkin?: string;
  checkout?: string;
  pickup: boolean;
  dropoff: boolean;
  mapUrl?: string;
  address?: string;
  saved: boolean;
};

const field =
  "w-full min-w-0 rounded-xl border border-catcha-line bg-paper px-3 py-3 text-sm text-brown placeholder:text-brown-faint";

/** ลูกค้ากรอกจุดรับ-ส่งน้องก่อนวันนัด — วางลิงก์ Google Maps หรือกดใช้ตำแหน่งปัจจุบัน */
function BookingTransportContent() {
  const id = useSearchParams().get("id") || "";
  const { profile } = useLiff();
  const { L, en } = useL();
  const fmtD = (d: string) => (en ? dateFor(d, true) : formatThaiDateShort(d));

  const [bk, setBk] = useState<Bk | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapUrl, setMapUrl] = useState("");
  const [address, setAddress] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // ป๊อปอัปสรุปให้เช็คก่อนส่งจริง
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const q = new URLSearchParams({ id });
    if (profile?.lineUserId) q.set("lineUserId", profile.lineUserId);
    fetch(`/api/bookings/transport?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.found) return;
        setBk(d.booking);
        setMapUrl(d.booking.mapUrl || "");
        setAddress(d.booking.address || "");
      })
      .finally(() => setLoading(false));
  }, [id, profile?.lineUserId]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError(L("เครื่องนี้ส่งตำแหน่งไม่ได้ — วางลิงก์ Google Maps แทนได้เลยค่ะ", "This device can't share its location. Paste a Google Maps link instead."));
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setMapUrl(`https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`);
        setLocating(false);
      },
      () => {
        setError(L("ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง — วางลิงก์ Google Maps แทนได้เลยค่ะ", "Location permission wasn't given. Paste a Google Maps link instead."));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  /** กดส่ง → เช็คว่ามีอย่างน้อย 1 ช่อง แล้วโชว์สรุปก่อน */
  const review = () => {
    if (!mapUrl.trim() && !address.trim()) {
      setError(L("ใส่ลิงก์ Google Maps หรือที่อยู่อย่างน้อย 1 ช่องนะคะ", "Please fill in a Google Maps link or an address."));
      return;
    }
    setError("");
    setReviewing(true);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/bookings/transport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: id,
          mapUrl: mapUrl.trim(),
          address: address.trim(),
          lineUserId: profile?.lineUserId,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setReviewing(false);
        setDone(true);
        savedPopup(L("ส่งตำแหน่งสำเร็จ", "Location sent"), [L("ร้านได้รับที่อยู่รับ-ส่งแล้วค่ะ", "The shop has your pick-up/drop-off address")]);
      } else {
        setError(
          d.error === "bad_url"
            ? L("ลิงก์ไม่ถูกต้อง — คัดลอกลิงก์จากปุ่มแชร์ใน Google Maps มาวางได้เลยค่ะ", "Invalid link. Copy the link from the Share button in Google Maps and paste it here.")
            : L("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง หรือส่งตำแหน่งในแชท LINE ได้เลยค่ะ", "Could not save. Try again, or send your location in the LINE chat.")
        );
      }
    } catch {
      setError(L("เชื่อมต่อไม่สำเร็จ — เช็คสัญญาณอินเทอร์เน็ตแล้วลองใหม่นะคะ", "Couldn't connect. Check your internet and try again."));
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    try {
      const liff = (await import("@line/liff")).default;
      if (liff.isInClient()) liff.closeWindow();
    } catch {
      /* ไม่ได้เปิดใน LINE */
    }
  };

  if (done) {
    return (
      <div className="px-4 pb-6 pt-10">
        <div className="rounded-catcha border border-catcha-line bg-card p-6 text-center shadow-catcha">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/25 text-ok">
            <Icon name="check" size={28} strokeWidth={2.4} />
          </span>
          <h1 className="mt-4 text-lg font-extrabold text-catcha-chocolate">{L("ได้รับจุดรับ-ส่งแล้วค่ะ", "We got your pick-up/drop-off point")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-brown-soft">
            {L("พี่เลี้ยงจะติดต่อก่อนออกเดินทางนะคะ", "Our staff will contact you before heading out.")}
            <br />
            {L("กลับไปที่แชท LINE ได้เลยค่ะ", "You can go back to the LINE chat now")}
          </p>
          <button type="button" onClick={finish} className={`mt-5 ${BTN_PRIMARY}`}>
            {L("กลับไปที่แชท", "Back to chat")}
          </button>
        </div>
      </div>
    );
  }

  const isRoom = bk?.service === "room";
  const legs = bk
    ? [
        bk.pickup && {
          label: L("รับน้อง", "Pick up"),
          date: isRoom ? bk.checkin : bk.date,
          time: isRoom ? undefined : bk.time,
        },
        bk.dropoff && {
          label: L("ส่งน้องกลับบ้าน", "Bring home"),
          date: isRoom ? bk.checkout : bk.date,
          time: undefined,
        },
      ].filter((x): x is { label: string; date: string | undefined; time: string | undefined } => !!x)
    : [];

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow="Pick-up & drop-off"
        title={L("จุดรับ-ส่งน้อง", "Pick-up & drop-off point")}
        back="/app"
        backLabel={L("กลับหน้าแรก", "Back to home")}
        showLang={false}
      />

      {loading ? (
        <LoadingScreen />
      ) : !bk ? (
        <div className="rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
          <EmptyState icon="calendar" title={L("ไม่พบข้อมูลการจอง", "Booking not found")} />
        </div>
      ) : !bk.pickup && !bk.dropoff ? (
        <div className="rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
          <EmptyState icon="car" title={L("นัดนี้ไม่ได้ใช้บริการรับ-ส่ง", "This booking has no pick-up/drop-off")} sub={L("ถ้าต้องการรับ-ส่ง ทักแชท LINE ได้เลยค่ะ", "Message us on LINE if you need it")} />
        </div>
      ) : (
        <>
          <div className="rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
            <p className="flex items-center gap-2 text-sm font-extrabold text-catcha-chocolate">
              <Icon name="paw" size={18} />
              {bk.catName}
            </p>
            <ul className="mt-3 space-y-2">
              {legs.map((l) => (
                <li key={l.label} className="flex items-center gap-2.5 rounded-xl bg-paper px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-honey/30 text-catcha-chocolate">
                    <Icon name="car" size={16} />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-bold text-brown">{l.label}</span>
                  <span className="shrink-0 text-xs text-brown-soft">
                    {l.date ? fmtD(l.date) : "—"}
                    {l.time ? ` · ${l.time}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <section className="mt-5">
            <SectionLabel>{L("Location · จุดรับ-ส่ง", "Location")}</SectionLabel>
            <div className="space-y-3 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
              <button
                type="button"
                onClick={useCurrentLocation}
                disabled={locating}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-honey/40 px-3 text-sm font-extrabold text-catcha-chocolate disabled:opacity-50"
              >
                <Icon name="pin" size={18} />
                {locating ? L("กำลังหาตำแหน่ง…", "Finding location…") : L("ใช้ตำแหน่งที่อยู่ตอนนี้", "Use my current location")}
              </button>

              <div>
                <p className="mb-1.5 text-xs font-bold text-brown-soft">{L("หรือวางลิงก์ Google Maps", "Or paste a Google Maps link")}</p>
                <input
                  value={mapUrl}
                  onChange={(e) => setMapUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/…"
                  inputMode="url"
                  className={field}
                />
                <p className="mt-1 text-[11px] text-brown-faint">
                  {L("เปิด Google Maps › ปักหมุด › แชร์ › คัดลอกลิงก์ แล้วนำมาวางที่นี่", "Open Google Maps › drop a pin › Share › Copy link, then paste it here")}
                </p>
                {mapUrl.trim() && /^https?:\/\//.test(mapUrl.trim()) && (
                  <a
                    href={mapUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-latte-deep underline-offset-2 hover:underline"
                  >
                    <Icon name="link" size={13} />
                    {L("เปิดดูแผนที่ที่ใส่ไว้", "Open the saved map")}
                  </a>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold text-brown-soft">{L("ที่อยู่ / จุดสังเกต (ถ้ามี)", "Address / landmark (optional)")}</p>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder={L("เช่น หมู่บ้าน… ซอย… บ้านรั้วสีขาว / คอนโดตึก B ฝากรปภ.ได้", "e.g. village, soi, white fence house / condo building B, leave with security")}
                  className={field}
                />
              </div>

              {error && (
                <p className="rounded-xl bg-wait/10 px-3 py-2 text-xs font-bold text-wait">{error}</p>
              )}

              <button type="button" disabled={saving} onClick={review} className={BTN_PRIMARY}>
                {saving ? L("กำลังบันทึก…", "Saving…") : bk.saved ? L("บันทึกการแก้ไข", "Save changes") : L("ส่งจุดรับ-ส่ง", "Send location")}
              </button>
              <ReviewSheet
                open={reviewing}
                sections={[
                  {
                    title: `${L("จุดรับ-ส่ง", "Pick-up & drop-off")}${bk.catName ? ` · ${bk.catName}` : ""}`,
                    icon: "car",
                    rows: [
                      ...legs.map((l) => ({
                        label: l.label,
                        value: [l.date ? fmtD(l.date) : "", l.time || ""].filter(Boolean).join(" "),
                      })),
                      { label: L("ลิงก์ Google Maps", "Google Maps link"), value: mapUrl.trim() },
                      { label: L("ที่อยู่ / จุดสังเกต", "Address / landmark"), value: address.trim() },
                    ],
                  },
                ]}
                saving={saving}
                error={error}
                confirmLabel={bk.saved ? L("ยืนยัน บันทึกการแก้ไข", "Confirm and save changes") : L("ยืนยัน ส่งจุดรับ-ส่ง", "Confirm and send")}
                onEdit={() => {
                  setReviewing(false);
                  setError("");
                }}
                onConfirm={save}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function BookingTransportPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BookingTransportContent />
    </Suspense>
  );
}
