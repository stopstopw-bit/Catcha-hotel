"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CustomerProfile } from "@/lib/business";
import type { PointsHistoryEntry } from "@/lib/points-store";
import type { CustomerTier } from "@/lib/customer-tier";
import { customerFetch, setCustomerSessionRefresher } from "@/lib/customer-fetch";

type LineCustomer = {
  id: string;
  name: string;
  phone?: string;
  cats: { id: string; name: string }[];
  tier: CustomerTier;
  /** สถานะ Member + เครดิตคงเหลือ — API ส่งมาอยู่แล้ว ใช้โชว์ในหน้าแรกของลูกค้า */
  isMember?: boolean;
  memberCredit?: number;
};

type LiffCtx = {
  ready: boolean;
  profile: CustomerProfile | null;
  customer: LineCustomer | null;
  needsRegistration: boolean;
  history: PointsHistoryEntry[];
  error: string | null;
  refreshAccount: () => Promise<void>;
  refreshCustomer: () => Promise<void>;
  setPoints: (points: number) => void;
};

const LiffContext = createContext<LiffCtx>({
  ready: false,
  profile: null,
  customer: null,
  needsRegistration: false,
  history: [],
  error: null,
  refreshAccount: async () => {},
  refreshCustomer: async () => {},
  setPoints: () => {},
});

async function fetchAccount(lineUserId: string, displayName: string, customerId?: string) {
  const q = new URLSearchParams({ lineUserId, displayName });
  if (customerId) q.set("customerId", customerId);
  // no-store — กัน webview ของ LINE เก็บผลแต้มเก่าไว้แล้วโชว์ค้าง (เช่น 0 ทั้งที่มีแต้ม)
  const res = await customerFetch(`/api/points?${q}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json() as Promise<{
    points: number;
    history: PointsHistoryEntry[];
  }>;
}

async function syncLineCustomer(lineUserId: string, displayName: string) {
  const res = await customerFetch("/api/customers/line", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lineUserId, displayName }),
  });
  if (!res.ok) return null;
  return res.json() as Promise<{
    customer: LineCustomer;
    needsRegistration: boolean;
  }>;
}

type LiffAuthModule = {
  getDecodedIDToken: () => { exp?: number } | null;
  login: (config?: { redirectUri?: string }) => void;
  logout: () => void;
  isInClient: () => boolean;
};

const RELOGIN_KEY = "catcha-liff-relogin";

/**
 * ID token ของ LIFF หมดอายุราว 1 ชม. แต่เปิดในเบราว์เซอร์นอก LINE แล้ว isLoggedIn() ยังเป็น true
 * และ getIDToken() คืน token เก่าที่หมดอายุแล้ว — แลกคุกกี้เซสชันไม่ผ่าน พอร้านเปิดบังคับเซสชัน
 * ลูกค้าจะไม่มีข้อมูลบัญชี (ขึ้น "สมัครสมาชิกให้เสร็จ" ค้าง / จองแล้วบอกว่าไม่มีแมว)
 * หมดอายุแล้ว → ล็อกอินใหม่เพื่อเอา token สด (กันวนซ้ำ: ลองได้ครั้งเดียวต่อ 1 นาที)
 * คืน true = กำลังพาไปล็อกอินใหม่ อย่าทำอะไรต่อ
 */
function reloginIfTokenExpired(liff: LiffAuthModule): boolean {
  // ในแอป LINE เปิดใหม่ทุกครั้งได้ token สดอยู่แล้ว (login() ใช้ในนั้นไม่ได้)
  if (typeof window === "undefined" || liff.isInClient()) return false;
  const exp = liff.getDecodedIDToken()?.exp;
  if (exp && exp * 1000 > Date.now() + 30_000) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOGIN_KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOGIN_KEY, String(Date.now()));
  } catch {
    return false;
  }
  liff.logout();
  liff.login({ redirectUri: window.location.href });
  return true;
}

export function LiffProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [customer, setCustomer] = useState<LineCustomer | null>(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [history, setHistory] = useState<PointsHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshCustomer = useCallback(async () => {
    if (!profile?.lineUserId) return;
    const sync = await syncLineCustomer(profile.lineUserId, profile.displayName);
    if (sync) {
      setCustomer(sync.customer);
      setNeedsRegistration(sync.needsRegistration);
    }
  }, [profile?.lineUserId, profile?.displayName]);

  const refreshAccount = useCallback(async () => {
    if (!profile?.lineUserId) return;
    const data = await fetchAccount(profile.lineUserId, profile.displayName, customer?.id);
    if (!data) return;
    setProfile((p) => (p ? { ...p, points: data.points } : p));
    setHistory(data.history);
  }, [profile?.lineUserId, profile?.displayName, customer?.id]);

  const setPoints = useCallback((points: number) => {
    setProfile((p) => (p ? { ...p, points } : p));
  }, []);

  useEffect(() => {
    async function initLiff() {
      async function applyAccount(base: CustomerProfile) {
        // sync ก่อนเพื่อรู้ customerId แล้วค่อยดึงแต้มด้วย customerId นั้น —
        // แต้มจะได้ผูกกับลูกค้าคนเดียวเสมอ ไม่แตกตามอุปกรณ์/LINE ID
        const sync = await syncLineCustomer(base.lineUserId, base.displayName);
        if (sync) {
          setCustomer(sync.customer);
          setNeedsRegistration(sync.needsRegistration);
        }
        const data = await fetchAccount(base.lineUserId, base.displayName, sync?.customer?.id);
        if (data) {
          setProfile({ ...base, points: data.points });
          setHistory(data.history);
        } else {
          setProfile(base);
        }
        setReady(true);
      }

      let liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim() || "";
      if (!liffId) {
        try {
          const res = await fetch("/api/line/liff");
          const data = await res.json();
          liffId = data.liffId || "";
        } catch {
          /* fallback dev */
        }
      }

      // เผลอวาง URL เต็ม (แม้ซ้ำ) ก็ตัดเหลือแต่รหัส กัน liff.init พัง
      liffId = liffId
        .replace(/https?:\/\/liff\.line\.me\//gi, "")
        .replace(/^\/+/, "")
        .split(/[?#/]/)[0]
        .trim();

      if (!liffId) {
        await applyAccount({
          lineUserId: "dev-user",
          displayName: "คุณทดสอบ",
          points: 0,
        });
        return;
      }

      import("@line/liff")
        .then((liff) =>
          liff.default.init({ liffId }).then(async () => {
            if (!liff.default.isLoggedIn()) {
              liff.default.login();
              return;
            }
            if (reloginIfTokenExpired(liff.default as unknown as LiffAuthModule)) return;
            // แลก ID token เป็นคุกกี้เซสชัน — จากนั้นฝั่งเซิร์ฟเวอร์จะรู้เองว่าเป็นใคร
            // โดยไม่ต้องเชื่อ lineUserId ที่ส่งไปกับ request
            // ไม่ผ่านรอบแรก (เน็ตสะดุด/LINE ตอบช้า) ลองซ้ำอีกครั้ง และเก็บไว้ให้ customerFetch
            // เรียกแลกใหม่ได้เองตอนเซิร์ฟเวอร์ตอบว่าไม่มีเซสชัน
            const exchange = async (): Promise<boolean> => {
              try {
                const idToken = liff.default.getIDToken();
                if (!idToken) return false;
                const r = await fetch("/api/customers/session", {
                  method: "POST",
                  cache: "no-store",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ idToken }),
                });
                const d = await r.json().catch(() => ({}));
                return Boolean(d?.ok);
              } catch {
                return false;
              }
            };
            setCustomerSessionRefresher(exchange);
            if (!(await exchange())) {
              await new Promise((r) => setTimeout(r, 800));
              await exchange();
            }

            const p = await liff.default.getProfile();
            await applyAccount({
              lineUserId: p.userId,
              displayName: p.displayName,
              pictureUrl: p.pictureUrl,
              points: 0,
            });
          })
        )
        .catch((e) => {
          setError(String(e));
          setReady(true);
        });
    }

    initLiff();

    // ถ้าล็อกอิน LINE ค้างระหว่างทาง (redirect ไม่กลับมา) อย่าค้างจอเปล่าตลอดไป
    const stuckTimer = setTimeout(() => {
      setReady((r) => {
        if (!r) setError("เข้าสู่ระบบช้ากว่าปกติ — ลองแตะปุ่มด้านล่างเพื่อโหลดใหม่");
        return r;
      });
    }, 10000);
    return () => clearTimeout(stuckTimer);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const path = params.get("path");
    const bookingId = params.get("id");

    if (path === "bookings") {
      router.replace(
        bookingId ? `/app/bookings?id=${bookingId}` : "/app/bookings"
      );
      return;
    }
    if (path === "promos") {
      router.replace("/app/promos");
      return;
    }
    if (path === "grooming") {
      router.replace("/app/grooming");
      return;
    }
    if (path === "rooms") {
      router.replace("/app/rooms");
      return;
    }
    if (path === "services") {
      router.replace("/app/services");
      return;
    }
    if (path === "consent") {
      const bkId = params.get("id");
      if (params.get("mode") === "customer") {
        router.replace(`/app/consent?mode=customer`);
        return;
      }
      router.replace(bkId ? `/app/consent?id=${encodeURIComponent(bkId)}` : `/app/consent`);
      return;
    }
    if (path === "booking-time") {
      const bkId = params.get("id");
      const type = params.get("type") || "checkin";
      router.replace(
        `/app/booking-time?id=${bkId || ""}&type=${type}`
      );
      return;
    }
    if (path === "booking-transport") {
      const bkId = params.get("id");
      router.replace(`/app/booking-transport?id=${encodeURIComponent(bkId || "")}`);
      return;
    }
    if (path === "profile") {
      router.replace("/app/profile");
      return;
    }
    if (path === "coupons") {
      router.replace("/app/coupons");
      return;
    }
    if (path === "claim-coupon") {
      const offer = params.get("offer");
      router.replace(offer ? `/app/claim-coupon?offer=${encodeURIComponent(offer)}` : "/app/coupons");
      return;
    }
    if (path === "pet-docs") {
      const q = new URLSearchParams({ need: params.get("need") === "idcard" ? "idcard" : "vaccine" });
      // ลิงก์จากนัด (id) หรือจากหน้าข้อมูลลูกค้า (cats = ตัวน้อง ไม่ต้องมีนัด)
      if (params.get("id")) q.set("id", params.get("id")!);
      if (params.get("cats")) q.set("cats", params.get("cats")!);
      router.replace(`/app/pet-docs?${q}`);
      return;
    }
    if (path === "groom-info") {
      const cats = params.get("cats");
      if (cats) {
        const kind = params.get("kind") === "stay" ? "stay" : "groom";
        router.replace(`/app/groom-info?cats=${encodeURIComponent(cats)}&kind=${kind}`);
        return;
      }
      const bkId = params.get("id");
      const bkKind = params.get("kind");
      router.replace(
        `/app/groom-info?id=${bkId || ""}${bkKind === "stay" || bkKind === "groom" ? `&kind=${bkKind}` : ""}`
      );
      return;
    }
    if (path === "register") {
      if (needsRegistration) {
        const ref = params.get("ref");
        router.replace(ref ? `/app/register?ref=${encodeURIComponent(ref)}` : "/app/register");
      } else {
        router.replace("/app");
      }
      return;
    }
    if (path === "link") {
      const customerId = params.get("customerId");
      router.replace(
        customerId
          ? `/app/link?customerId=${encodeURIComponent(customerId)}`
          : "/app"
      );
      return;
    }

    const skipRegister =
      pathname.startsWith("/app/register") ||
      pathname.startsWith("/app/link") ||
      pathname.startsWith("/app/bookings") ||
      pathname.startsWith("/app/pay") ||
      pathname.startsWith("/app/promos") ||
      pathname.startsWith("/app/grooming") ||
      pathname.startsWith("/app/rooms") ||
      pathname.startsWith("/app/services") ||
      pathname.startsWith("/app/consent") ||
      pathname.startsWith("/app/booking-time") ||
      pathname.startsWith("/app/booking-transport") ||
      pathname.startsWith("/app/profile") ||
      pathname.startsWith("/app/groom-info") ||
      pathname.startsWith("/app/pet-docs") ||
      pathname.startsWith("/app/coupons") ||
      pathname.startsWith("/app/claim-coupon");

    if (needsRegistration && !skipRegister) {
      router.replace("/app/register");
    }
  }, [ready, needsRegistration, pathname, router]);

  return (
    <LiffContext.Provider
      value={{
        ready,
        profile,
        customer,
        needsRegistration,
        history,
        error,
        refreshAccount,
        refreshCustomer,
        setPoints,
      }}
    >
      {children}
    </LiffContext.Provider>
  );
}

export function useLiff() {
  return useContext(LiffContext);
}
