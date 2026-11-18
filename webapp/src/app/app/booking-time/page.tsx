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
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { IntakeFlowBar } from "@/components/IntakeFlowBar";
import { flowProgress } from "@/lib/intake-flow";
import { useL } from "@/components/LocaleProvider";
import { dateFor } from "@/lib/locale-date";

type Bk = {
  id: string;
  catName: string;
  service: string;
  checkin?: string;
  checkout?: string;
  arrivalTime?: string;
  pickupTime?: string;
  shopPickup?: boolean;
  shopDropoff?: boolean;
};

function BookingTimeContent() {
  const { L, en } = useL();
  const params = useSearchParams();
  const id = params.get("id") || "";
  const type = params.get("type") === "checkout" ? "checkout" : "checkin";
  const { profile } = useLiff();

  const [bk, setBk] = useState<Bk | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const isCheckin = type === "checkin";
  // เปิดมาจากปุ่มเดียว (ไล่ทีละหน้า) — เลือกเวลาแล้วไปขั้นต่อไป ไม่ปิดหน้ากลับแชท
  const flow = flowProgress(params);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetch(`/api/bookings/time?id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.found) {
          setBk(d.booking);
          setSaved(type === "checkin" ? d.booking.arrivalTime : d.booking.pickupTime);
        }
      })
      .finally(() => setLoading(false));
  }, [id, type]);

  const pick = async (time: string) => {
    if (!time || !id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/bookings/time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: id,
          type,
          time,
          lineUserId: profile?.lineUserId,
        }),
      });
      if (res.ok) {
        setSaved(time);
        savedPopup(L("บันทึกเวลาสำเร็จ", "Time saved"), [
          en ? `${isCheckin ? "Drop-off" : "Pick-up"} time ${time}` : `${isCheckin ? "เวลามาส่ง" : "เวลามารับ"} ${time} น.`,
        ]);
      }
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    try {
      const liff = (await import("@line/liff")).default;
      if (liff.isInClient()) liff.closeWindow();
    } catch {
      /* ไม่ได้เปิดใน LINE — โชว์หน้าจอเสร็จสิ้นแทน */
    }
    setDone(true);
  };

  const dateLabel = isCheckin ? bk?.checkin : bk?.checkout;
  // นัดที่ใช้บริการรับ-ส่ง: ร้านเป็นฝ่ายเดินทาง ไม่ใช่ลูกค้า "มาส่ง/มารับ"
  const shopGoes = isCheckin ? !!bk?.shopPickup : !!bk?.shopDropoff;
  const title = shopGoes
    ? isCheckin
      ? L("เลือกเวลาให้ร้านไปรับน้อง", "Choose when we pick up your cat")
      : L("เลือกเวลาให้ร้านไปส่งน้องที่บ้าน", "Choose when we bring your cat home")
    : isCheckin
      ? L("เลือกเวลาที่จะมาส่งน้อง", "Choose your drop-off time")
      : L("เลือกเวลาที่จะมารับน้อง", "Choose your pick-up time");

  if (done) {
    return (
      <div className="px-4 pb-6 pt-10">
        <div className="rounded-catcha border border-catcha-line bg-card p-6 text-center shadow-catcha">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/25 text-ok">
          <Icon name="check" size={28} strokeWidth={2.4} />
        </span>
        <h1 className="mt-4 text-lg font-extrabold text-catcha-chocolate">
          {L("บันทึกเวลาเรียบร้อยแล้ว!", "Time saved!")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-brown-soft">
          {shopGoes
            ? isCheckin
              ? L(`ร้านจะไปรับ${bk?.catName || "น้อง"}ตามจุดรับ-ส่งตอน ${saved} นะคะ 🚗`, `We will pick up ${bk?.catName || L("น้อง", "your cat")} at ${saved} 🚗`)
              : L(`ร้านจะพา${bk?.catName || "น้อง"}ไปส่งที่บ้านตอน ${saved} นะคะ 🚗`, `We will bring ${bk?.catName || L("น้อง", "your cat")} home at ${saved} 🚗`)
            : isCheckin
              ? L(`เราจะเตรียมห้องรอต้อนรับ${bk?.catName || "น้อง"}ตอน ${saved} นะคะ 🐱`, `We will have the room ready for ${bk?.catName || L("น้อง", "your cat")} at ${saved} 🐱`)
              : L(`เราจะเตรียม${bk?.catName || "น้อง"}ให้พร้อมก่อนกลับบ้านตอน ${saved} นะคะ 🐱`, `We will have ${bk?.catName || L("น้อง", "your cat")} ready to go home at ${saved} 🐱`)}
          <br />
          {L("กลับไปที่แชท LINE ได้เลยค่ะ", "You can go back to the LINE chat now")}
        </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow={shopGoes ? (isCheckin ? "Pick-up by shop" : "Delivery time") : isCheckin ? "Drop-off time" : "Pick-up time"}
        title={title}
        back="/app"
        backLabel={L("กลับหน้าแรก", "Back to home")}
        showLang={false}
      />
      <IntakeFlowBar mode="progress" />

      {loading ? (
        <LoadingScreen />
      ) : !bk ? (
        <div className="rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
          <EmptyState icon="calendar" title={L("ไม่พบข้อมูลการจอง", "Booking not found")} />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-honey/25 text-catcha-chocolate">
              <Icon name="paw" size={20} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-catcha-chocolate">{bk.catName}</p>
              <p className="text-xs text-brown-soft">
                {isCheckin ? L("วันเข้าพัก", "Check-in") : L("วันรับน้อง", "Pick-up day")}:{" "}
                {dateLabel ? (en ? dateFor(dateLabel, true) : formatThaiDateShort(dateLabel)) : "—"}
              </p>
            </div>
          </div>

          <section className="mt-5">
            <SectionLabel>{saved ? L("Change time · เปลี่ยนเวลา (ถ้าต้องการ)", "Change time (optional)") : L("Time · เลือกเวลา", "Choose a time")}</SectionLabel>
            <div className="rounded-catcha border border-catcha-line bg-paper p-3 shadow-catcha-sm">
              <TimeSlotPicker value={saved} onPick={pick} disabled={saving} />
            </div>
          </section>

          {saved && (
            <div className="mt-5 rounded-catcha bg-sage/15 p-4">
              <p className="flex items-center justify-center gap-1.5 text-base font-extrabold text-catcha-chocolate">
                <Icon name="check" size={18} strokeWidth={2.4} className="text-ok" />
                {L(`เลือกเวลา ${saved} แล้ว`, `${saved} selected`)}
              </p>
              {flow?.next ? (
                <a href={flow.next.href} className={`mt-3 ${BTN_PRIMARY}`}>
                  {L("ถัดไป", "Next")}: {en ? flow.next.labelEn : flow.next.label}
                  <Icon name="chevron" size={16} />
                </a>
              ) : (
                <>
                  <p className="mt-1 text-center text-xs text-brown-soft">
                    {L("ถ้าถูกต้องแล้ว กดปุ่มด้านล่างเพื่อยืนยันและกลับไปที่แชทได้เลยค่ะ 🧡", "If this looks right, tap below to confirm and go back to the chat 🧡")}
                  </p>
                  <button type="button" onClick={finish} className={`mt-3 ${BTN_PRIMARY}`}>
                    {L("เสร็จแล้ว — กลับไปที่แชท", "Done, back to chat")}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function BookingTimePage() {
  return (
    <Suspense
      fallback={<LoadingScreen />}
    >
      <BookingTimeContent />
    </Suspense>
  );
}
