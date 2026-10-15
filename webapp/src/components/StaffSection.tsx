"use client";

import { useCallback, useEffect, useState } from "react";
import { ADMIN_TABS } from "@/components/AdminNav";
import { ADMIN_TAB_ICONS, Icon } from "@/components/Icon";
import { Avatar, EmptyState, MoreMenu, SectionLabel } from "@/components/ui";

export type StaffItem = {
  id: string;
  name: string;
  code: string;
  menus: string[];
  active: boolean;
};

/**
 * จัดการบัญชีพนักงาน — เจ้าของเท่านั้นที่เห็น (API ตอบ 403 ให้พนักงาน)
 *
 * แยกออกมาจากหน้าตั้งค่าเพราะมันเป็นงานคนละเรื่องกับการตั้งค่าระบบ
 * และเจ้าของร้านหาไม่เจอเวลามันซ่อนอยู่ท้ายหน้า
 */
export function StaffSection() {
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newMenus, setNewMenus] = useState<string[]>([
    "/admin",
    "/admin/schedule",
    "/admin/bookings/new",
    "/admin/customers",
    "/admin/billing",
  ]);
  const [busy, setBusy] = useState(false);

  const adminCode =
    typeof window !== "undefined" ? sessionStorage.getItem("catcha-admin") || "" : "";

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/staff", {
        headers: { "x-admin-code": adminCode },
      });
      if (res.status === 403) {
        setIsOwner(false);
        setLoaded(true);
        return;
      }
      const d = await res.json();
      setStaff(d.staff || []);
      setIsOwner(true);
    } catch {
      /* เงียบ — โชว์เป็นลิสต์ว่าง */
    }
    setLoaded(true);
  }, [adminCode]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleMenu = (list: string[], href: string) =>
    list.includes(href) ? list.filter((h) => h !== href) : [...list, href];

  const addStaff = async () => {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-code": adminCode },
        body: JSON.stringify({ action: "add", name: newName, code: newCode, menus: newMenus }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg(`เพิ่ม "${newName}" แล้ว — ให้พนักงานใช้รหัสนี้ล็อกอินได้เลย`);
        setNewName("");
        setNewCode("");
        load();
      } else {
        setMsg(`${d.error || "เพิ่มไม่สำเร็จ"}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const patchStaff = async (id: string, patch: Record<string, unknown>) => {
    await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-code": adminCode },
      body: JSON.stringify({ id, ...patch }),
    });
    load();
  };

  const removeStaff = async (s: StaffItem) => {
    if (!confirm(`ลบบัญชีพนักงาน "${s.name}"?`)) return;
    await fetch(`/api/admin/staff?id=${s.id}`, {
      method: "DELETE",
      headers: { "x-admin-code": adminCode },
    });
    load();
  };

  if (!loaded) {
    return <p className="py-10 text-center text-sm text-brown-soft">กำลังโหลด…</p>;
  }
  if (!isOwner) {
    return (
      <div className="rounded-catcha bg-card shadow-catcha-sm">
        <EmptyState icon="alert" title="หน้านี้สำหรับเจ้าของร้านเท่านั้น" />
      </div>
    );
  }

  const menuPicker = (selected: string[], onToggle: (href: string) => void) => (
    <div className="grid grid-cols-2 gap-x-2">
      {ADMIN_TABS.map((t) => (
        <label key={t.href} className="flex min-h-[40px] items-center gap-2 text-xs text-brown">
          <input
            type="checkbox"
            checked={selected.includes(t.href)}
            onChange={() => onToggle(t.href)}
            className="h-4 w-4 shrink-0 accent-[#4A7348]"
          />
          <Icon name={ADMIN_TAB_ICONS[t.href] || "grid"} size={14} className="text-brown-soft" />
          <span className="min-w-0 truncate">{t.label}</span>
        </label>
      ))}
    </div>
  );

  const field = "w-full min-w-0 rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm";

  return (
    <div className="space-y-5">
      <section>
        <SectionLabel>Staff · บัญชีพนักงาน ({staff.length})</SectionLabel>
        <div className="rounded-catcha bg-card shadow-catcha-sm">
          {staff.length === 0 ? (
            <EmptyState icon="team" title="ยังไม่มีพนักงาน" sub="เพิ่มคนแรกได้ที่ช่องด้านล่าง" />
          ) : (
            <ul className="divide-y divide-catcha-line">
              {staff.map((s) => (
                <li key={s.id}>
                  <details className="group [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-4 py-2.5">
                      <Avatar name={s.name} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-extrabold text-catcha-chocolate">{s.name}</span>
                          {!s.active && (
                            <span className="shrink-0 rounded-full bg-paper px-1.5 text-[10px] font-bold leading-4 text-brown-faint">
                              พักใช้งาน
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[11px] text-brown-soft">
                          รหัส {s.code} · เห็น {s.menus.length} เมนู
                        </span>
                      </span>
                      <Icon name="chevron" size={16} className="text-brown-faint transition group-open:rotate-90" />
                    </summary>
                    <div className="space-y-3 bg-paper/50 px-4 pb-3 pt-2">
                      <p className="text-[11px] font-bold text-brown-soft">เมนูที่ให้เห็น</p>
                      {menuPicker(s.menus, (href) =>
                        patchStaff(s.id, { menus: toggleMenu(s.menus, href) })
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const code = prompt("ตั้งรหัสใหม่ (อย่างน้อย 4 ตัว):", s.code);
                            if (code && code.trim().length >= 4) patchStaff(s.id, { code: code.trim() });
                          }}
                          className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-card text-xs font-bold text-brown"
                        >
                          <Icon name="edit" size={14} />
                          เปลี่ยนรหัส
                        </button>
                        <MoreMenu
                          items={[
                            {
                              label: s.active ? "พักการใช้งาน" : "เปิดใช้งาน",
                              icon: s.active ? "clock" : "check",
                              onClick: () => patchStaff(s.id, { active: !s.active }),
                            },
                            { label: "ลบบัญชี", icon: "trash", danger: true, onClick: () => removeStaff(s) },
                          ]}
                        />
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-1.5 px-1 text-[10px] text-brown-faint">
          พนักงานล็อกอินด้วยรหัสของตัวเองที่หน้าเดิม จะเห็นเฉพาะเมนูที่เลือกไว้
        </p>
      </section>

      <section>
        <SectionLabel>New · เพิ่มพนักงานใหม่</SectionLabel>
        <div className="space-y-3 rounded-catcha bg-card p-4 shadow-catcha-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="ชื่อพนักงาน"
              className={field}
            />
            <input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="รหัสเข้าใช้ (4 ตัวขึ้นไป)"
              className={field}
            />
          </div>
          <p className="text-[11px] font-bold text-brown-soft">เมนูที่ให้เห็น</p>
          {menuPicker(newMenus, (href) => setNewMenus((prev) => toggleMenu(prev, href)))}
          <button
            type="button"
            disabled={busy || !newName.trim() || newCode.trim().length < 4}
            onClick={addStaff}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-catcha-chocolate text-sm font-extrabold text-card disabled:opacity-40"
          >
            <Icon name="plus" size={18} />
            {busy ? "กำลังเพิ่ม…" : "เพิ่มพนักงาน"}
          </button>
          {msg && <p className="text-[11px] font-bold text-brown">{msg}</p>}
        </div>
      </section>
    </div>
  );
}
