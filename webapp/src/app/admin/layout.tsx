"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LocaleProvider } from "@/components/LocaleProvider";
import { Logo } from "@/components/Logo";
import { HeaderBand } from "@/components/HeaderBand";
import {
  AdminBottomBar,
  AdminNav,
  AdminSidebar,
  getActiveAdminTabLabel,
  getAllowedMenus,
  isPathAllowed,
} from "@/components/AdminNav";
import { Toaster } from "@/components/Toast";

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setOk(true);
      return;
    }
    // สิทธิ์จริงถูกตรวจที่ middleware แล้ว (คุกกี้เซ็นชื่อ) — ตรงนี้แค่ยืนยันกับเซิร์ฟเวอร์
    // ว่ายังล็อกอินอยู่ไหม แล้วซิงก์บทบาท/เมนูให้ตรงกับของจริง
    let alive = true;
    (async () => {
      const res = await fetch("/api/auth/login").catch(() => null);
      if (!alive) return;
      if (!res || !res.ok) {
        sessionStorage.removeItem("catcha-role");
        sessionStorage.removeItem("catcha-menus");
        router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const me = await res.json().catch(() => null);
      if (!alive || !me?.ok) return;
      sessionStorage.setItem("catcha-role", me.role);
      sessionStorage.setItem("catcha-staff-name", me.name || "พนักงาน");
      if (me.role === "staff") {
        sessionStorage.setItem("catcha-menus", JSON.stringify(me.menus || []));
      } else {
        sessionStorage.removeItem("catcha-menus");
      }
      // พนักงาน — เข้าได้เฉพาะเมนูที่เจ้าของอนุญาต ถ้าหลุดมาหน้าอื่นเด้งกลับเมนูแรกที่มีสิทธิ์
      const allowed = getAllowedMenus();
      if (!isPathAllowed(pathname, allowed)) {
        router.replace(allowed && allowed[0] ? allowed[0] : "/admin/login");
        return;
      }
      setOk(true);
      // อัปเดตฐานข้อมูลอัตโนมัติครั้งเดียวต่อ session (idempotent, ไม่บล็อก UI)
      if (!sessionStorage.getItem("catcha-migrated")) {
        sessionStorage.setItem("catcha-migrated", "1");
        fetch("/api/admin/migrate", { method: "POST" }).catch(() => {});
      }
    })();
    return () => {
      alive = false;
    };
  }, [pathname, router]);

  if (!ok) return null;

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const logout = async () => {
    // ต้องล้างคุกกี้ที่เซิร์ฟเวอร์ด้วย ไม่ใช่แค่ล้างใน sessionStorage
    await fetch("/api/auth/login", { method: "DELETE" }).catch(() => {});
    sessionStorage.clear();
    router.push("/admin/login");
  };

  // แดชบอร์ด: แถบหัวสูง ให้การ์ดสรุปเกยขึ้นไป · หน้าอื่นมีหัวข้อของตัวเองอยู่แล้ว ใช้แถบหัวแบบเตี้ย
  const isDashboard = pathname === "/admin";

  return (
    <div className="min-h-screen bg-catcha-gradient pb-28 lg:pb-0">
      <Toaster />
      <header className="print:hidden">
        <HeaderBand className={isDashboard ? "pb-10 lg:pb-12" : "pb-4 lg:pb-5"}>
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pb-1 pt-4 lg:max-w-6xl lg:px-6 lg:pt-6">
            <Logo size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-catcha-chocolate/70">
                CatCha Admin · หลังบ้าน
              </p>
              <p
                className={`truncate font-extrabold text-catcha-chocolate ${
                  isDashboard ? "text-xl lg:text-2xl" : "text-base lg:text-lg"
                }`}
              >
                {getActiveAdminTabLabel(pathname)}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-full bg-card/70 px-3.5 py-1.5 text-xs font-extrabold text-catcha-chocolate shadow-catcha-sm backdrop-blur lg:text-sm"
            >
              ออก
            </button>
          </div>
        </HeaderBand>
      </header>
      <AdminNav menuOpen={menuOpen} setMenuOpen={setMenuOpen} />
      <div className={`mx-auto max-w-3xl ${isDashboard ? "-mt-6" : "mt-5 lg:mt-6"} px-4 lg:grid lg:max-w-6xl lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6 lg:px-6`}>
        <aside className="print:hidden">
          <AdminSidebar />
        </aside>
        <main className="relative min-w-0 rounded-t-catcha pb-5 lg:pb-8">{children}</main>
      </div>
      <AdminBottomBar menuOpen={menuOpen} onMenu={() => setMenuOpen(!menuOpen)} />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <AdminShell>{children}</AdminShell>
    </LocaleProvider>
  );
}
