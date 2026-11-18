"use client";

import { savedPopup } from "@/components/Toast";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiff } from "@/components/LiffProvider";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BTN_PRIMARY, PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useL } from "@/components/LocaleProvider";

type Offer = { id: string; title: string; amount: number; reason: string; validDays: number; active: boolean };

function ClaimContent() {
  const params = useSearchParams();
  const offerId = params.get("offer") || "";
  const { profile } = useLiff();
  const { L } = useL();

  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<"" | "ok" | "already" | "error">("");

  useEffect(() => {
    if (!offerId) {
      setLoading(false);
      return;
    }
    fetch(`/api/coupons/claim?offer=${offerId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.found) setOffer(d.offer);
      })
      .finally(() => setLoading(false));
  }, [offerId]);

  const claim = async () => {
    if (!offerId || !profile?.lineUserId) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/coupons/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, lineUserId: profile.lineUserId }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok && d.ok) {
        setResult("ok");
        savedPopup(L("รับคูปองสำเร็จ 🎟️", "Coupon claimed 🎟️"));
      }
      else if (d.alreadyClaimed) setResult("already");
      else setResult("error");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!offer)
    return (
      <div className="px-4 pb-6 pt-5">
        <PageHeader eyebrow="Coupon" title={L("คูปองส่วนลดพิเศษ", "Special discount coupon")} back="/app" backLabel={L("กลับหน้าแรก", "Back to home")} showLang={false} />
        <div className="rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
          <EmptyState icon="ticket" title={L("ไม่พบคูปองนี้", "Coupon not found")} sub={L("หรือแคมเปญปิดแล้วค่ะ", "or the campaign has ended")} />
        </div>
        <Link href="/app/coupons" className={`mt-5 ${BTN_PRIMARY}`}>
          <Icon name="wallet" size={18} />
          {L("ดูกระเป๋าคูปองของฉัน", "View my coupon wallet")}
        </Link>
      </div>
    );

  if (result === "ok" || result === "already")
    return (
      <div className="px-4 pb-6 pt-10">
        <div className="rounded-catcha border border-catcha-line bg-card p-6 text-center shadow-catcha">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/25 text-ok">
            <Icon name="check" size={28} strokeWidth={2.4} />
          </span>
          <h1 className="mt-4 text-lg font-extrabold text-catcha-chocolate">
            {result === "ok" ? L("รับคูปองเรียบร้อยแล้ว!", "Coupon claimed!") : L("คุณรับคูปองนี้ไปแล้วนะคะ", "You already claimed this coupon")}
          </h1>
          <p className="mt-2 text-sm text-brown-soft">
            {L(`คูปองส่วนลด ${offer.amount} บาท อยู่ในกระเป๋าคูปองของคุณแล้ว 🧡`, `A ${offer.amount} THB discount coupon is now in your wallet 🧡`)}
          </p>
        </div>
        <Link href="/app/coupons" className={`mt-5 ${BTN_PRIMARY}`}>
          <Icon name="wallet" size={18} />
          {L("ดูกระเป๋าคูปอง", "View coupon wallet")}
        </Link>
      </div>
    );

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader eyebrow="Coupon" title={L("คูปองส่วนลดพิเศษ", "Special discount coupon")} back="/app" backLabel={L("กลับหน้าแรก", "Back to home")} showLang={false} />
      <div className="relative overflow-hidden rounded-catcha border border-honey/50 bg-gradient-to-br from-honey/30 via-card to-latte/15 p-6 text-center shadow-catcha">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-card text-latte-deep shadow-catcha-sm">
          <Icon name="ticket" size={24} />
        </span>
        <p className="mt-3 text-sm font-bold text-brown">{offer.title}</p>
        <p className="mt-1 text-4xl font-extrabold text-latte-deep">
          ฿{offer.amount.toLocaleString()}
        </p>
        {offer.reason && offer.reason !== offer.title && (
          <p className="mt-2 text-xs text-brown-soft">{offer.reason}</p>
        )}
        <p className="mt-2 text-[11px] text-brown-faint">{L(`ใช้เป็นส่วนลดได้ (${offer.validDays} วัน)`, `Valid for ${offer.validDays} days`)}</p>
      </div>
      {result === "error" && (
        <p className="mt-3 rounded-catcha-sm bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600">
          {L("รับคูปองไม่สำเร็จ ลองใหม่นะคะ", "Could not claim the coupon, please try again")}
        </p>
      )}
      <button
        type="button"
        onClick={claim}
        disabled={claiming || !offer.active}
        className={`mt-5 ${BTN_PRIMARY}`}
      >
        {offer.active && !claiming && <Icon name="gift" size={18} />}
        {claiming ? L("กำลังรับ…", "Claiming…") : offer.active ? L("กดรับคูปองเข้ากระเป๋า", "Add coupon to my wallet") : L("แคมเปญปิดแล้ว", "Campaign ended")}
      </button>
      <Link
        href="/app/coupons"
        className="mt-2 flex min-h-[44px] items-center justify-center gap-1 text-xs font-bold text-brown-soft"
      >
        {L("ดูกระเป๋าคูปองของฉัน", "View my coupon wallet")}
        <Icon name="chevron" size={14} />
      </Link>
    </div>
  );
}

export default function ClaimCouponPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <ClaimContent />
    </Suspense>
  );
}
