"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const ADMIN_TABS = [
  { href: "/admin", label: "แดชบอร์ด", icon: "📊" },
  { href: "/admin/schedule", label: "ตารางนัด", icon: "🗓️" },
  { href: "/admin/bookings/new", label: "จองใหม่", icon: "➕" },
  { href: "/admin/customers", label: "ลูกค้า", icon: "👤" },
  { href: "/admin/billing", label: "คิดเงิน", icon: "💳" },
  { href: "/admin/finance", label: "รายรับ-รายจ่าย", icon: "📒" },
  { href: "/admin/tax", label: "เอกสารรายได้ / ภาษี", icon: "📑" },
  { href: "/admin/insights", label: "สรุปข้อมูล", icon: "📊" },
  { href: "/admin/promos", label: "โปร", icon: "✨" },
  { href: "/admin/coupons", label: "คูปอง", icon: "🎟️" },
  { href: "/admin/birthdays", label: "วันเกิดลูกค้า", icon: "🎂" },
  { href: "/admin/packages", label: "ขายคอร์สในแอป", icon: "🛍️" },
  { href: "/admin/cards", label: "ปรับแต่งการ์ด LINE", icon: "🎴" },
  { href: "/admin/articles", label: "บทความหน้าเว็บ", icon: "📝" },
  { href: "/admin/staff", label: "พนักงาน", icon: "👥" },
  { href: "/admin/settings", label: "ตั้งค่า", icon: "⚙️" },
  { href: "/admin/trash", label: "ถังขยะ", icon: "🗑️" },
  { href: "/admin/setup", label: "ติดตั้ง", icon: "🚀" },
] as const;

const TABS = ADMIN_TABS;

function isTabActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** เมนูที่ผู้ใช้ปัจจุบันเห็นได้ — null = เจ้าของ (เห็นทุกเมนู) */
export function getAllowedMenus(): string[] | null {
  if (typeof window === "undefined") return null;
  if (sessionStorage.getItem("catcha-role") !== "staff") return null;
  try {
    const menus = JSON.parse(sessionStorage.getItem("catcha-menus") || "[]");
    return Array.isArray(menus) ? menus : [];
  } catch {
    return [];
  }
}

/** พนักงานเปิดหน้าที่ไม่มีสิทธิ์ได้ไหม — ใช้ทั้ง nav และ guard ใน layout */
export function isPathAllowed(pathname: string, allowed: string[] | null) {
  if (!allowed) return true;
  return allowed.some((href) => isTabActive(pathname, href));
}

export function getActiveAdminTabLabel(pathname: string) {
  return TABS.find((t) => isTabActive(pathname, t.href))?.label || "เมนู";
}

function NavLink({
  href,
  label,
  icon,
  active,
  onNavigate,
  className = "",
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-catcha-sm font-bold transition ${
        active
          ? "bg-honey/40 text-catcha-chocolate"
          : "text-brown-soft hover:bg-honey/15 hover:text-catcha-chocolate"
      } ${className}`}
    >
      <span aria-hidden className="text-lg leading-none">
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}

export function AdminMenuButton({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls="admin-menu"
      aria-label={open ? "ปิดเมนู" : "เปิดเมนู"}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-catcha-sm border border-catcha-line bg-paper"
    >
      <span className="relative block h-4 w-5">
        <span
          className={`absolute left-0 top-0 block h-0.5 w-5 rounded-full bg-catcha-chocolate transition ${
            open ? "top-[7px] rotate-45" : ""
          }`}
        />
        <span
          className={`absolute left-0 top-[7px] block h-0.5 w-5 rounded-full bg-catcha-chocolate transition ${
            open ? "opacity-0" : ""
          }`}
        />
        <span
          className={`absolute bottom-0 left-0 block h-0.5 w-5 rounded-full bg-catcha-chocolate transition ${
            open ? "bottom-[7px] -rotate-45" : ""
          }`}
        />
      </span>
    </button>
  );
}

export function AdminNav({
  menuOpen,
  setMenuOpen,
}: {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}) {
  const pathname = usePathname();
  // เมนูของพนักงานถูกกรองตามสิทธิ์ที่เจ้าของตั้งไว้ (เมนูเปิดหลัง mount เสมอ อ่าน sessionStorage ได้เลย)
  const allowed = getAllowedMenus();
  const visibleTabs = TABS.filter((t) => !allowed || allowed.includes(t.href));

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, setMenuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen, setMenuOpen]);

  const closeMenu = () => setMenuOpen(false);

  if (!menuOpen) return null;

  return (
    <>
      <button
        type="button"
        aria-label="ปิดเมนู"
        className="fixed inset-0 z-40 bg-catcha-chocolate/30 lg:hidden"
        onClick={closeMenu}
      />
      <nav
        id="admin-menu"
        className="fixed inset-x-0 bottom-0 z-[44] max-h-[85vh] overflow-y-auto rounded-t-[32px] bg-card px-4 pb-28 pt-3 shadow-catcha lg:hidden"
        aria-label="เมนูหลังบ้าน"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-catcha-line" />
        <p className="mb-3 px-1 text-sm font-extrabold text-catcha-chocolate">เมนูทั้งหมด</p>
        <ul className="mx-auto grid max-w-lg grid-cols-4 gap-x-2 gap-y-4">
          {visibleTabs.map((tab) => {
            const active = isTabActive(pathname, tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  onClick={closeMenu}
                  className="flex flex-col items-center gap-1.5 text-center"
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full border text-2xl ${
                      active
                        ? "border-honey-deep bg-honey/50"
                        : "border-catcha-line bg-paper"
                    }`}
                  >
                    <span aria-hidden className="leading-none">
                      {tab.icon}
                    </span>
                  </span>
                  <span
                    className={`text-[11px] font-bold leading-tight ${
                      active ? "text-catcha-chocolate" : "text-brown"
                    }`}
                  >
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** แถบเมนูซ้ายบนจอใหญ่ — แสดงทุกเมนูที่ผู้ใช้มีสิทธิ์ */
export function AdminSidebar() {
  const pathname = usePathname();
  const allowed = getAllowedMenus();
  const visibleTabs = TABS.filter((t) => !allowed || allowed.includes(t.href));
  return (
    <nav
      aria-label="เมนูหลังบ้าน"
      className="sticky top-6 hidden max-h-[calc(100vh-3rem)] overflow-y-auto rounded-catcha bg-card p-3 shadow-catcha lg:block"
    >
      <ul className="space-y-1">
        {visibleTabs.map((tab) => (
          <li key={tab.href}>
            <NavLink
              {...tab}
              active={isTabActive(pathname, tab.href)}
              className="w-full px-3 py-2.5 text-sm"
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** แถบเมนูล่างบนมือถือ — 4 เมนูหลัก + ปุ่ม "เมนู" เปิดทั้งหมด */
const BOTTOM_TABS = ["/admin", "/admin/schedule", "/admin/bookings/new", "/admin/customers"];

export function AdminBottomBar({
  menuOpen,
  onMenu,
}: {
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const pathname = usePathname();
  const allowed = getAllowedMenus();
  const tabs = TABS.filter(
    (t) => BOTTOM_TABS.includes(t.href) && (!allowed || allowed.includes(t.href))
  );
  const anyActive = tabs.some((t) => isTabActive(pathname, t.href));
  return (
    <nav
      aria-label="เมนูลัด"
      className="fixed inset-x-0 bottom-0 z-[45] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] print:hidden lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1 rounded-catcha border border-catcha-line bg-card/95 px-2 py-2 shadow-catcha backdrop-blur-md">
        {tabs.map((tab) => {
          const active = !menuOpen && isTabActive(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-catcha-sm px-1 py-1.5 text-[10px] font-extrabold transition ${
                active ? "bg-honey/35 text-catcha-chocolate" : "text-brown-soft"
              }`}
            >
              <span aria-hidden className="text-xl leading-none">
                {tab.icon}
              </span>
              <span className="truncate leading-tight">{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="admin-menu"
          onClick={onMenu}
          className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-catcha-sm px-1 py-1.5 text-[10px] font-extrabold transition ${
            menuOpen || !anyActive ? "bg-honey/35 text-catcha-chocolate" : "text-brown-soft"
          }`}
        >
          <span aria-hidden className="text-xl leading-none">
            ☰
          </span>
          <span className="truncate leading-tight">เมนู</span>
        </button>
      </div>
    </nav>
  );
}
