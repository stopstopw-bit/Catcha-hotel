"use client";

import { savedPopup } from "@/components/Toast";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLiff } from "@/components/LiffProvider";
import { LoadingScreen } from "@/components/LoadingScreen";
import { BTN_PRIMARY, BTN_SECONDARY, PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useL } from "@/components/LocaleProvider";
import { trNow } from "@/components/LocaleProvider";

type Preview = {
  id: string;
  name: string;
  phone?: string;
  cats: { id: string; name: string }[];
  hasLine: boolean;
};

export function LinkLineContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = searchParams.get("customerId") || "";
  const { profile, ready, refreshCustomer } = useLiff();
  const { L } = useL();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setLoading(false);
      setError(trNow("ลิงก์ไม่ถูกต้อง", "Invalid link"));
      return;
    }
    fetch(`/api/customers/link?customerId=${encodeURIComponent(customerId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.customer) setPreview(d.customer);
        else setError(d.error || trNow("ไม่พบลูกค้า", "Customer not found"));
      })
      .catch(() => setError(trNow("โหลดข้อมูลไม่สำเร็จ", "Could not load")))
      .finally(() => setLoading(false));
  }, [customerId]);

  const link = async () => {
    if (!profile?.lineUserId || !customerId) return;
    setLinking(true);
    setError("");

    const res = await fetch("/api/customers/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        lineUserId: profile.lineUserId,
        displayName: profile.displayName,
      }),
    });
    const data = await res.json();
    setLinking(false);

    if (!res.ok) {
      setError(data.error || L("ผูกไม่สำเร็จ", "Could not link"));
      return;
    }

    await refreshCustomer();
    setDone(true);
    savedPopup(L("ผูก LINE สำเร็จ", "LINE linked"), [], { afterNav: true });
    setTimeout(() => router.replace("/app"), 1500);
  };

  if (!ready || loading) {
    return <LoadingScreen message={L("กำลังเชื่อมต่อ LINE…", "Connecting to LINE…")} />;
  }

  if (!customerId || (!preview && error)) {
    return (
      <div className="px-4 pb-6 pt-5">
        <PageHeader eyebrow="Link account" title={L("ผูกบัญชี LINE", "Link LINE account")} showLang={false} />
        <div className="rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
          <EmptyState icon="alert" title={error || L("ลิงก์ไม่ถูกต้อง", "Invalid link")} />
        </div>
      </div>
    );
  }

  if (preview?.hasLine) {
    return (
      <div className="px-4 pb-6 pt-10">
        <div className="rounded-catcha border border-catcha-line bg-card p-6 text-center shadow-catcha">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/25 text-ok">
            <Icon name="check" size={28} strokeWidth={2.4} />
          </span>
          <p className="mt-3 text-base font-extrabold text-catcha-chocolate">
            {L("ลูกค้ารายนี้ผูก LINE แล้ว", "This customer is already linked to LINE")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.replace("/app")}
          className={`mt-5 ${BTN_SECONDARY}`}
        >
          <Icon name="home" size={16} />
          {L("ไปหน้าแรก", "Go to home")}
        </button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="px-4 pb-6 pt-10">
        <div className="rounded-catcha border border-catcha-line bg-card p-6 text-center shadow-catcha">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sage/25 text-ok">
            <Icon name="check" size={28} strokeWidth={2.4} />
          </span>
          <p className="mt-3 text-base font-extrabold text-ok">{L("ผูก LINE สำเร็จ!", "LINE linked!")}</p>
          <p className="mt-1 text-xs text-brown-soft">{L("กำลังพาไปหน้าแรก…", "Taking you home…")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow="Link account"
        title={L("ผูกบัญชี LINE", "Link LINE account")}
        subtitle={L("ร้านบันทึกข้อมูลไว้แล้ว — กดยืนยันเพื่อเชื่อมกับ LINE ของคุณ", "The shop has saved your details. Confirm to link them with your LINE.")}
        showLang={false}
      />

      {preview && (
        <div className="mb-5 overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-honey/25 text-catcha-chocolate">
              <Icon name="user" size={20} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-catcha-chocolate">{preview.name}</p>
              {preview.phone && (
                <p className="text-xs text-brown-soft">{preview.phone}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 border-t border-catcha-line px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage/25 text-catcha-chocolate">
              <Icon name="paw" size={20} />
            </span>
            <p className="min-w-0 text-sm text-brown">
              {preview.cats.map((c) => c.name).join(", ") || "—"}
            </p>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-3 rounded-catcha-sm bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={linking || !profile?.lineUserId}
        onClick={link}
        className={BTN_PRIMARY}
      >
        {!linking && <Icon name="link" size={18} />}
        {linking ? L("กำลังผูก…", "Linking…") : L("ยืนยันผูก LINE กับบัญชีนี้", "Link LINE to this account")}
      </button>

      <p className="mt-3 text-center text-[11px] text-brown-faint">
        {L("ชื่อ LINE", "LINE name")}: {profile?.displayName}
      </p>
    </div>
  );
}
