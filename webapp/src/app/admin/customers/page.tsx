"use client";

import { splitVaccinePhotos } from "@/lib/vaccine-photos";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import type { CatRecord, CustomerRecord, MemberCreditUsageRecord, MemberTopupRecord, PackageUsageRecord } from "@/lib/customers-store";
import type { CustomerTier } from "@/lib/customer-tier";
import { toJpegDataUrl } from "@/lib/image-convert";
import { CatPhoto } from "@/components/CatPhoto";
import { BuyerSheet, type Buyer } from "@/components/BuyerSheet";
import { CatMediaGallery } from "@/components/CatMediaGallery";
import { TIER_LABELS, tierBadgeClass } from "@/lib/customer-tier";
import { RegistrationQrSection } from "@/components/LineSetupSection";
import { AddCustomerModal } from "@/components/AddCustomerModal";
import { EditCustomerSheet } from "@/components/EditCustomerSheet";
import { CatServiceHistory } from "@/components/CatServiceHistory";
import type { HistoryBill } from "@/lib/cat-service-history";
import { pastPriceList, type PastInvoice } from "@/lib/special-price";
import { lastGroomForPet } from "@/lib/pet-groom-memory";
import { PastPricesList } from "@/components/PastPrices";
import { toast } from "@/components/Toast";
import { PreviewSendModal } from "@/components/PreviewSendModal";
import { CustomerIntakeCards } from "@/components/CustomerIntakeCards";
import { CustomerLinkSection } from "@/components/CustomerLinkSection";
import type { PointsHistoryEntry } from "@/lib/points-store";
import { parseGroomInfo, groomInfoSummary } from "@/lib/groom-info";
import { STAY_FORM_DEFAULTS } from "@/lib/stay-form";
import type { Booking } from "@/lib/business";
import { bookingGroupKey, groupBookings } from "@/lib/booking-group";
import { ExportSheetsButton } from "@/components/ExportSheetsButton";
import { BookingEditModal, type EditableBooking } from "@/components/BookingEditModal";
import { RoomPlanSection } from "@/components/RoomPlanSection";
import { BREED_OPTIONS, OTHER_BREED } from "@/lib/cat-breeds";
import { BirthdayPicker } from "@/components/BirthdayPicker";
import { StaffNoteTagPicker } from "@/components/StaffNoteTagPicker";
import { Icon } from "@/components/Icon";
import { useConfig } from "@/components/ConfigProvider";
import { isFeatureOn } from "@/lib/features";
import { GroomProgramPicker, useGroomPrograms } from "@/components/GroomProgramPicker";
import { RoomTypePicker, useRoomOptions } from "@/components/RoomTypePicker";
import { OfferItemsEditor, emptyItem, itemsToPayload, type OfferItemDraft } from "@/components/OfferItemsEditor";
import { groomProgramName } from "@/lib/grooming-prices";
import { tidyServiceText } from "@/lib/stay-line";
import { Avatar, EmptyState, MoreMenu, SearchField, Segmented, SectionLabel } from "@/components/ui";

type Summary = {
  customer: CustomerRecord;
  points: number;
  visits: number;
  lastVisitDate?: string | null;
  daysSinceVisit?: number | null;
  inactive?: boolean;
  canFollowUp?: boolean;
  history: {
    bookings: Booking[];
    upcomingBookings: EditableBooking[];
    pastBookings: EditableBooking[];
    services: { id: string; service: string; date: string; amount?: number; catName: string }[];
    points: PointsHistoryEntry[];
    memberTopups: MemberTopupRecord[];
    memberCreditUsage: MemberCreditUsageRecord[];
    packageUsage: PackageUsageRecord[];
    serviceBills?: HistoryBill[];
  };
};

type CustomerListItem = CustomerRecord & { upcomingAppointments?: number; points?: number };
type SortKey =
  | "name"
  | "tier"
  | "points"
  | "credit"
  | "upcoming"
  | "birthday"
  | "recent"
  | "updated"
  | "cats"
  | "catName"
  | "phone"
  | "line"
  | "birthdaySoon";

const SORT_OPTIONS: { key: SortKey; label: string; defaultDir: "asc" | "desc" }[] = [
  { key: "recent", label: "สมัครล่าสุด", defaultDir: "desc" },
  { key: "updated", label: "เคลื่อนไหวล่าสุด (แก้ไข/มาใช้บริการ)", defaultDir: "desc" },
  { key: "name", label: "ชื่อลูกค้า ก–ฮ", defaultDir: "asc" },
  { key: "catName", label: "ชื่อแมว ก–ฮ", defaultDir: "asc" },
  { key: "cats", label: "จำนวนแมว", defaultDir: "desc" },
  { key: "upcoming", label: "จำนวนนัดที่จะมาถึง", defaultDir: "desc" },
  { key: "points", label: "แต้มสะสม", defaultDir: "desc" },
  { key: "credit", label: "เครดิต Member", defaultDir: "desc" },
  { key: "tier", label: "กลุ่มลูกค้า", defaultDir: "asc" },
  { key: "birthdaySoon", label: "วันเกิดใกล้ถึง (เจ้าของ/แมว)", defaultDir: "asc" },
  { key: "birthday", label: "ปีเกิดเจ้าของ", defaultDir: "asc" },
  { key: "line", label: "ผูก LINE แล้ว/ยังไม่ผูก", defaultDir: "desc" },
  { key: "phone", label: "เบอร์โทร", defaultDir: "asc" },
];

/** กี่วันนับจากวันนี้ถึงวันเกิดครั้งถัดไป (ดูแค่เดือน-วัน) — ไม่มีวันเกิดคืน 9999 */
function daysToNextBirthday(birthday?: string): number {
  const m = (birthday || "").match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) return 9999;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), Number(m[1]) - 1, Number(m[2]));
  if (next < today) next = new Date(now.getFullYear() + 1, Number(m[1]) - 1, Number(m[2]));
  return Math.round((next.getTime() - today.getTime()) / 86400000);
}

function bookingWhen(b: EditableBooking) {
  if (b.service === "room" || b.checkin) {
    return `${b.checkin || b.date}${b.checkout ? ` → ${b.checkout}` : ""}`;
  }
  return `${b.date}${b.time ? ` ${b.time}` : ""}`;
}

function statusLabel(status: Booking["status"]) {
  if (status === "confirmed") return "ยืนยันแล้ว";
  if (status === "cancelled") return "ยกเลิกแล้ว";
  return "รอยืนยัน";
}

/** หัวการ์ดส่วนต่างๆ ในหน้าลูกค้า: ไอคอนในกรอบมน · ชื่อ · ค่าด้านขวา (ถ้ามี) */
function CardHeader({
  icon,
  title,
  sub,
  right,
}: {
  icon: string;
  title: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-honey/25 text-catcha-chocolate">
        <Icon name={icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-extrabold text-catcha-chocolate">{title}</h2>
        {sub ? <div className="truncate text-[11px] text-brown-soft">{sub}</div> : null}
      </div>
      {right}
    </div>
  );
}

/** ช่องติ๊กแบบแถวใหญ่ (กดได้ทั้งแถว) — ใช้กับ "ยอดยกมา" / "แจ้งลูกค้าทาง LINE" */
function CheckRow({
  checked,
  onChange,
  icon,
  title,
  sub,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: string;
  title: string;
  sub: React.ReactNode;
}) {
  return (
    <label
      className={`flex min-h-[48px] cursor-pointer items-start gap-3 rounded-catcha-sm border px-3 py-2.5 text-[11px] font-bold transition ${
        checked ? "border-latte-deep/50 bg-latte/15 text-catcha-chocolate" : "border-catcha-line bg-paper/60 text-brown-soft"
      }`}
    >
      <Icon name={icon} size={18} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        {title}
        <span className="block font-normal text-brown-faint">{sub}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-latte-deep"
      />
    </label>
  );
}

/**
 * การ์ดฟอร์มแบบพับได้ (ปิดไว้ก่อน) — ฟอร์มที่ไม่ได้ใช้ทุกวันจะไม่รกหน้า
 * แตะหัวการ์ดเพื่อเปิด/ปิด
 */
function CollapsibleCard({
  icon,
  title,
  sub,
  children,
}: {
  icon: string;
  title: string;
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mb-3 rounded-catcha bg-card shadow-catcha-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[64px] w-full items-center gap-3 p-4 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-honey/25 text-catcha-chocolate">
          <Icon name={icon} size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold text-catcha-chocolate">{title}</span>
          {sub ? <span className="block truncate text-[11px] text-brown-soft">{sub}</span> : null}
        </span>
        <Icon
          name="chevron"
          size={18}
          className={`shrink-0 text-brown-soft transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && <div className="border-t border-catcha-line p-4 pt-3">{children}</div>}
    </section>
  );
}

const inputCls =
  "w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm outline-none transition focus:border-latte-deep focus:bg-card";

/**
 * หน้าลูกค้าเป็นของบ้านเดียวอยู่แล้ว — จัดกลุ่มแค่ "บริการ + วันเวลาเดียวกัน" ไม่ดูชื่อ/รหัสลูกค้าบนนัด
 * (นัดที่ลูกค้าจองเองกับนัดที่ร้านลงให้ บางทีมีรหัสลูกค้าไม่ตรงกัน แล้วจะแตกเป็นคนละนัด)
 */
function groupHousehold(list: EditableBooking[]): EditableBooking[][] {
  return groupBookings(list.map((b) => ({ ...b, customerId: "", customerName: "" }))).map((g) =>
    g.map((x) => list.find((b) => b.id === x.id)!)
  );
}

function CustomerAppointmentsSection({
  bookings,
  catNames,
  onRefresh,
}: {
  bookings: EditableBooking[];
  /** แมวที่ลูกค้าบันทึกไว้ — ให้เลือกแทนชื่อชั่วคราว "น้องไม่ระบุชื่อ" ได้เลย */
  catNames: string[];
  onRefresh: () => void;
}) {
  const [editing, setEditing] = useState<EditableBooking | null>(null);
  const [rooms, setRooms] = useState<{ id: string; name: string; size: string; price: number }[]>([]);
  const [groomSlots, setGroomSlots] = useState<string[]>(["09:30", "12:30", "15:30"]);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => {
        if (d.config?.rooms) setRooms(d.config.rooms);
        if (d.config?.groomSlots) setGroomSlots(d.config.groomSlots);
      });
  }, []);

  // บ้านเดียวกัน นัดเดียวกัน = 1 นัด (ใส่ชื่อน้องทุกตัว) ไม่แตกเป็นรายตัว
  const groups = groupHousehold(bookings);

  const cancelGroup = async (group: EditableBooking[]) => {
    const names = group.map((b) => b.catName).join(", ");
    if (!confirm(`ยกเลิกนัด ${names} · ${group[0].date}?`)) return;
    const results = await Promise.all(
      group.map((b) =>
        fetch("/api/bookings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: b.id, action: "cancel" }),
        })
      )
    );
    if (results.every((r) => r.ok)) {
      toast("ยกเลิกนัดแล้ว", "success");
    } else {
      alert("ยกเลิกไม่สำเร็จบางตัว — ลองใหม่อีกครั้ง");
    }
    onRefresh();
  };

  return (
    <section className="mb-4 rounded-catcha bg-card p-4 shadow-catcha-sm">
      {editing && (
        <BookingEditModal
          booking={editing}
          rooms={rooms}
          groomSlots={groomSlots}
          customerCats={catNames}
          takenCatNames={bookings
            .filter((x) => x.id !== editing.id && bookingGroupKey(x) === bookingGroupKey(editing))
            .map((x) => x.catName)}
          onClose={() => setEditing(null)}
          onSaved={onRefresh}
        />
      )}
      <CardHeader
        icon="calendar"
        title="นัดหมาย"
        sub={groups.length ? `${groups.length} นัดที่กำลังจะมาถึง · แตะเพื่อแก้ไข` : undefined}
      />
      {bookings.length === 0 ? (
        <EmptyState icon="calendar" title="ยังไม่มีนัดที่กำลังจะมาถึง" />
      ) : (
        <ul className="divide-y divide-catcha-line rounded-catcha-sm border border-catcha-line bg-card">
          {groups.map((group) => {
            const b = group[0];
            const many = group.length > 1;
            return (
            <li key={group.map((g) => g.id).join(",")} className="flex items-center gap-1 pr-2">
              <button
                type="button"
                onClick={() => setEditing(b)}
                className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left active:bg-paper"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-honey/25 text-catcha-chocolate">
                  <Icon name={b.service === "room" ? "bed" : "bath"} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-extrabold text-catcha-chocolate">
                      {b.service === "room" ? "ห้องพัก" : "อาบน้ำ"}
                    </span>
                    {many && (
                      <span className="shrink-0 rounded-full bg-latte/25 px-1.5 py-px text-[10px] font-extrabold text-latte-deep">
                        {group.length} ตัว
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-[11px] font-bold text-brown">
                    {group.map((g) => g.catName).join(", ")}
                  </span>
                  <span className="block truncate text-[11px] text-brown-soft">{bookingWhen(b)}</span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    b.status === "confirmed" ? "bg-sage/20 text-ok" : "bg-honey/25 text-wait"
                  }`}
                >
                  {statusLabel(b.status)}
                </span>
              </button>
              <MoreMenu
                items={[
                  { label: many ? "แก้ไขนัดทั้งบ้าน" : "แก้ไขนัด", icon: "edit", onClick: () => setEditing(b) },
                  // แก้เฉพาะบางตัว (เช่น ตัวเดียวเปลี่ยนห้อง/โปรแกรม) ซ่อนไว้ในเมนู
                  ...(many
                    ? group.slice(1).map((g) => ({
                        label: `แก้เฉพาะ ${g.catName}`,
                        icon: "edit",
                        onClick: () => setEditing(g),
                      }))
                    : []),
                  {
                    label: many ? "ยกเลิกนัดทั้งบ้าน" : "ยกเลิกนัด",
                    icon: "x",
                    danger: true,
                    onClick: () => cancelGroup(group),
                  },
                  // น้องบางตัวไม่มา (เช่น ป่วย) — ยกเลิกเฉพาะตัวนั้น ตัวอื่นในบ้านยังนัดอยู่
                  ...(many
                    ? group.map((g) => ({
                        label: `ยกเลิกเฉพาะ ${g.catName}`,
                        icon: "x",
                        danger: true,
                        onClick: () => cancelGroup([g]),
                      }))
                    : []),
                ]}
              />
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const MEMBER_PROMOS = [
  { label: "10,000 → 12,000", paid: 10000, bonus: 2000 },
  { label: "5,000 → 5,500", paid: 5000, bonus: 500 },
  { label: "3,000 → 3,200", paid: 3000, bonus: 200 },
] as const;

function MemberTopupSection({
  customerId,
  memberCredit,
  onDone,
}: {
  customerId: string;
  memberCredit: number;
  onDone: () => void;
}) {
  const [paid, setPaid] = useState("");
  const [bonus, setBonus] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  // ยอดยกมาจากระบบเก่า — เติมเครดิตให้ลูกค้าจริง แต่ไม่ใช่เงินที่รับเข้าร้านเดือนนี้
  const [isLegacy, setIsLegacy] = useState(false);
  // 🔁 ยกเลิกนัดแล้วเก็บยอดบิลเป็นเครดิต — เงินเข้าร้าน + แต้มได้ไปแล้วตอนจ่ายบิลเดิม
  // จึงไม่ลงรายรับ/ไม่ให้แต้มซ้ำ (ถ้าเติมแบบปกติ รายรับกับแต้มจะเบิ้ลจากเงินก้อนเดียว)
  const [isCancelCredit, setIsCancelCredit] = useState(false);
  const [sourceInvoiceId, setSourceInvoiceId] = useState("");
  /** ค่าเริ่มต้น = ไม่แจ้ง — ยกยอดเก่าเข้าระบบทีละหลายคนไม่ควรไปกวนลูกค้า */
  const [notify, setNotify] = useState(false);
  const [topupPreview, setTopupPreview] = useState<Record<string, unknown>[] | null>(null);

  const paidNum = Math.max(0, Number(paid) || 0);
  const bonusNum = isCancelCredit ? 0 : Math.max(0, Number(bonus) || 0);
  const total = paidNum + bonusNum;

  const applyPromo = (p: number, b: number) => {
    setPaid(String(p));
    setBonus(String(b));
    setMsg("");
  };

  const topupPayload = () => ({
    id: customerId,
    action: "topup_member",
    paidAmount: paidNum,
    bonusAmount: bonusNum,
    note: note.trim() || undefined,
    isLegacy: isLegacy && !isCancelCredit,
    isCancelCredit,
    sourceInvoiceId: isCancelCredit ? sourceInvoiceId.trim() || undefined : undefined,
    notify,
  });

  const submit = async () => {
    if (total <= 0) {
      setMsg("กรอกยอดรับเงินหรือแถมอย่างน้อย 1 บาท");
      return;
    }
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(topupPayload()),
    });
    const data = await res.json();
    setSaving(false);
    setTopupPreview(null);
    if (res.ok) {
      setPaid("");
      setBonus("");
      setNote("");
      setIsLegacy(false);
      setIsCancelCredit(false);
      setSourceInvoiceId("");
      setNotify(false);
      setMsg(
        `✅ เติมสำเร็จ +${total.toLocaleString()} บาท (คงเหลือ ${data.customer.memberCredit.toLocaleString()} บาท)` +
          (isCancelCredit
            ? " · 🔁 จากบิลยกเลิกนัด ไม่ลงรายรับ · ไม่ให้แต้มซ้ำ (ได้ไปแล้วตอนจ่ายบิล)"
            : isLegacy
            ? " · ยอดยกมา ไม่นับรายรับเดือนนี้ · ไม่ได้แต้ม (ไม่ใช่เงินรอบนี้)"
            // บอกชัดว่าได้แต้มเท่าไหร่ — ไม่งั้นพนักงานเดาไม่ออกว่าระบบให้แต้มจริงไหม
            // ตอนลูกค้าถามว่าทำไมไม่ได้แต้ม (เช่น ปิดสวิตช์ไว้ หรือจ่ายเป็นยอดแถมล้วนไม่มีเงินจ่ายจริง)
            : data.pointsEarned > 0
              ? ` · ได้แต้ม +${data.pointsEarned} 🎁`
              : " · ไม่ได้แต้ม (เช็คตั้งค่า > แต้มสะสม ว่าเปิดให้แต้มตอนเติมไว้ไหม)") +
          // เงินลงเรียบร้อยเสมอ — ถ้าส่ง LINE ไม่ได้ต้องบอกตรงๆ ไม่ใช่บอกว่าแจ้งแล้ว
          (notify
            ? data.notifyError
              ? ` · ⚠️ ส่ง LINE ไม่ได้: ${data.notifyError}`
              : " · แจ้งลูกค้าแล้ว 💬"
            : "")
      );
      onDone();
    } else {
      setMsg(data.error && data.error !== "invalid_topup" ? `❌ ${data.error}` : "❌ บันทึกไม่สำเร็จ");
    }
  };

  const previewTopup = async () => {
    if (total <= 0) {
      setMsg("กรอกยอดรับเงินหรือแถมอย่างน้อย 1 บาท");
      return;
    }
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...topupPayload(), preview: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.preview)) {
        setTopupPreview(data.preview);
      } else {
        setMsg("❌ ดูตัวอย่างการ์ดไม่สำเร็จ");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollapsibleCard
      icon="wallet"
      title="เติมเครดิต Member"
      sub={
        <>
          คงเหลือ <span className="font-bold text-latte-deep">{memberCredit.toLocaleString()} บาท</span>
        </>
      }
    >

      <SectionLabel>Quick promo · โปรด่วน</SectionLabel>
      <div className="mb-3 flex flex-wrap gap-2">
        {MEMBER_PROMOS.map((p) => {
          const on = paidNum === p.paid && bonusNum === p.bonus;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPromo(p.paid, p.bonus)}
              className={`min-h-[40px] rounded-full border px-3.5 py-2 text-xs font-bold transition ${
                on
                  ? "border-catcha-chocolate bg-catcha-chocolate text-card"
                  : "border-catcha-line bg-card text-catcha-chocolate"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="block text-[11px] font-bold text-brown-soft">
          {isCancelCredit ? "ยอดบิลเดิม (บาท)" : "รับเงินจริง (บาท)"}
          <input
            type="number"
            min={0}
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            placeholder="10000"
            className={`mt-1 font-bold text-catcha-chocolate ${inputCls}`}
          />
        </label>
        <label className="block text-[11px] font-bold text-brown-soft">
          แถมเครดิต (บาท)
          <input
            type="number"
            min={0}
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
            placeholder={isCancelCredit ? "—" : "2000"}
            disabled={isCancelCredit}
            className={`mt-1 font-bold text-latte-deep ${inputCls}`}
          />
        </label>
      </div>

      {total > 0 && (
        <p className="mb-3 rounded-catcha-sm bg-honey/20 px-3 py-2 text-center text-xs font-bold text-catcha-chocolate">
          ลูกค้าได้เครดิตรวม <span className="text-base">{total.toLocaleString()}</span> บาท
          {bonusNum > 0 && (
            <span className="block text-[10px] font-normal text-brown-soft">
              (จ่าย {paidNum.toLocaleString()} + แถม {bonusNum.toLocaleString()})
            </span>
          )}
        </p>
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="โน้ต (ถ้ามี) เช่น โปรปีใหม่"
        className={`mb-2 ${inputCls}`}
      />

      <div className="mb-3 space-y-2">
        <CheckRow
          checked={isLegacy}
          onChange={(v) => {
            setIsLegacy(v);
            if (v) setIsCancelCredit(false);
          }}
          icon="clock"
          title="ยอดยกมาจากระบบเก่า"
          sub={
            <>
              เติมเครดิตให้ลูกค้าตามปกติ แต่จะ<b>ไม่นับเป็นรายรับ</b>ของร้านเดือนนี้
            </>
          }
        />
        <CheckRow
          checked={isCancelCredit}
          onChange={(v) => {
            setIsCancelCredit(v);
            if (v) setIsLegacy(false);
          }}
          icon="back"
          title="ยกเลิกนัด เก็บยอดบิลที่จ่ายแล้วเป็นเครดิต"
          sub={
            <>
              <b>ไม่ลงรายรับ ไม่ให้แต้มซ้ำ</b> (ได้ไปแล้วตอนจ่ายบิล) · ทำได้ในคลิกเดียวจากปุ่มที่บิล
            </>
          }
        />
        {isCancelCredit && (
          <input
            value={sourceInvoiceId}
            onChange={(e) => setSourceInvoiceId(e.target.value)}
            placeholder="เลขบิลเดิม (ถ้ามี) — โชว์ในประวัติเครดิต"
            className={inputCls}
          />
        )}
        <CheckRow
          checked={notify}
          onChange={setNotify}
          icon="message"
          title="แจ้งลูกค้าทาง LINE ด้วย"
          sub="ส่งการ์ดยอดคงเหลือให้ลูกค้า (เสียโควตา 1 ข้อความ) · ไม่ติ๊ก = เติมเงียบๆ"
        />
      </div>

      <button
        type="button"
        disabled={saving || total <= 0}
        onClick={notify ? previewTopup : submit}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-catcha-sm bg-catcha-chocolate px-3 py-3 text-sm font-extrabold text-card shadow-catcha-sm disabled:opacity-40"
      >
        {!saving && <Icon name={notify ? "eye" : "plus"} size={18} />}
        {saving
          ? "กำลังบันทึก…"
          : notify
            ? "ดูการ์ดก่อนเติม"
            : isCancelCredit
              ? `เก็บเป็นเครดิต +${total > 0 ? total.toLocaleString() : "—"} บาท (ไม่นับรายรับ)`
              : isLegacy
              ? `บันทึกยอดยกมา +${total > 0 ? total.toLocaleString() : "—"} บาท (ไม่นับรายรับ)`
              : `บันทึกเติม Member +${total > 0 ? total.toLocaleString() : "—"} บาท`}
      </button>

      {topupPreview && (
        <PreviewSendModal
          messages={topupPreview}
          sending={saving}
          onConfirm={submit}
          onCancel={() => setTopupPreview(null)}
        />
      )}

      {msg && (
        <p className="mt-2 rounded-catcha-sm bg-paper px-3 py-2 text-center text-[11px] font-bold text-brown">{msg}</p>
      )}
    </CollapsibleCard>
  );
}

function formatThaiDateTimeShort(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    calendar: "gregory",
  });
  const time = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time} น.`;
}

/**
 * การเข้าพัก + เงื่อนไข — หลักฐานที่ลูกค้าเซ็นยอมรับก่อนฝากแมว (วันเข้า-ออก, ลายเซ็น, โน้ตดูแลเพิ่มเติม)
 *
 * เมื่อก่อนข้อมูลนี้บันทึกไว้จริง (booking.consentAcceptedAt/careNote/consentSignature)
 * แต่ไม่เคยโผล่ที่ไหนในหลังบ้านเลย — ต้องไปหาทีละนัดในปฏิทินเอง ตอนนี้รวมมาไว้ที่นี่
 * ที่เดียว จะได้ใช้เป็นหลักฐานได้ทันทีถ้ามีปัญหา ไม่ต้องไล่หา
 */
/** บิลย่อในประวัติลูกค้า → รูปแบบที่ special-price / pet-groom-memory อ่านได้ */
function billsAsPast(bills?: HistoryBill[]): PastInvoice[] {
  return (bills || []).map((b) => ({
    createdAt: b.date,
    items: b.items.map((it) => ({ ...it, amount: it.amount ?? 0 })),
  }));
}

/**
 * ราคาที่ลูกค้าคนนี้เคยจ่าย แยกน้องแต่ละตัว + บริการ — อ่านจากบิล ไม่ต้องกรอกเพิ่ม
 * น้องที่ได้ราคาพิเศษ พนักงานคนไหนเปิดดูก็รู้ราคาเดิม (หน้าคิดเงินจะถามให้ใช้ราคาเดิมเองด้วย)
 */
function PastPricesSection({ bills }: { bills?: HistoryBill[] }) {
  const [showAll, setShowAll] = useState(false);
  const prices = pastPriceList(billsAsPast(bills));
  if (prices.length === 0) return null;
  return (
    <section className="mb-4 rounded-catcha bg-card p-4 shadow-catcha-sm">
      <CardHeader
        icon="money"
        title="ราคาที่ลูกค้าคนนี้เคยจ่าย"
        sub="ราคาล่าสุดของน้องแต่ละตัว แยกตามบริการ · ตอนออกบิลระบบจะถามให้ใช้ราคาเดิม"
      />
      <PastPricesList prices={prices} limit={showAll ? undefined : 6} />
      {prices.length > 6 && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 min-h-[40px] w-full rounded-catcha-sm bg-paper py-2 text-xs font-extrabold text-latte-deep"
        >
          ดูทั้งหมดอีก {prices.length - 6} รายการ
        </button>
      )}
    </section>
  );
}

function StaysConsentSection({ bookings }: { bookings: EditableBooking[] }) {
  // ชื่อห้องจริงแทน id (catflix → Catflix & Chill)
  const [roomNames, setRoomNames] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) =>
        setRoomNames(
          Object.fromEntries(((d.config?.rooms || []) as { id: string; name: string }[]).map((r) => [r.id, r.name]))
        )
      )
      .catch(() => {});
  }, []);

  // บ้านเดียวกัน ช่วงวันเดียวกัน = การเข้าพักครั้งเดียว (ระบบเก็บแถวละตัว) → รวมเป็นรายการเดียว
  const stays = groupBookings(
    bookings
      .filter((b) => b.service === "room" && b.status !== "cancelled")
      .map((b) => ({ ...b, customerName: b.customerName || "" }))
  )
    .map((group) => {
      const signed = group.find((x) => x.consentAcceptedAt);
      const rooms = new Map<string, number>();
      for (const x of group) if (x.room) rooms.set(x.room, (rooms.get(x.room) || 0) + 1);
      const roomUnits = new Set(group.map((x) => `${x.room}#${x.roomUnit ?? ""}`));
      return {
        ...(signed || group[0]),
        id: group[0].id,
        cats: group.map((x) => x.catName).filter(Boolean).join(", "),
        roomText: Array.from(rooms.keys())
          .map((r) => roomNames[r] || r)
          .join(" + "),
        roomCount: roomUnits.size > 1 ? roomUnits.size : 0,
        careNote: Array.from(new Set(group.map((x) => x.careNote).filter(Boolean))).join(" · "),
        consentSignature: signed?.consentSignature || group.find((x) => x.consentSignature)?.consentSignature,
        vaccinePhotoUrl: group.find((x) => x.vaccinePhotoUrl)?.vaccinePhotoUrl,
      };
    })
    .sort((a, b) => (b.checkin || b.date).localeCompare(a.checkin || a.date));

  if (stays.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="mb-4 rounded-catcha bg-card p-4 shadow-catcha-sm">
      <CardHeader icon="bed" title="การเข้าพัก + เงื่อนไข" sub={`${stays.length} ครั้ง · หลักฐานที่ลูกค้าเซ็นยอมรับ`} />
      <ul className="divide-y divide-catcha-line rounded-catcha-sm border border-catcha-line">
        {stays.map((b) => {
          const staying =
            (b.checkin || "") <= today && today < (b.checkout || b.checkin || "");
          return (
            <li key={b.id} className="px-3 py-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-bold text-brown">
                  {b.checkin || b.date}
                  {b.checkout ? ` → ${b.checkout}` : ""}
                  {b.roomText ? ` · ${b.roomText}` : ""}
                  {b.roomCount ? ` (${b.roomCount} ห้อง)` : ""}
                </span>
                {staying && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ok/20 px-2 py-0.5 text-[10px] font-extrabold text-ok">
                    <Icon name="bed" size={12} />
                    กำลังเข้าพักอยู่
                  </span>
                )}
              </div>
              {b.cats && <p className="mt-0.5 text-[11px] text-brown-soft">{b.cats}</p>}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {b.consentAcceptedAt ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ok">
                    <Icon name="check" size={12} strokeWidth={2.4} />
                    เซ็นยอมรับแล้ว · {formatThaiDateTimeShort(b.consentAcceptedAt)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-wait">
                    <Icon name="clock" size={12} />
                    ยังไม่ได้เซ็นยอมรับ
                  </span>
                )}
                {b.consentSignature && (
                  <a
                    href={b.consentSignature}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold bg-latte/30 text-catcha-chocolate"
                  >
                    <Icon name="edit" size={12} />
                    ดูลายเซ็น
                  </a>
                )}
                {splitVaccinePhotos(b.vaccinePhotoUrl).map((url, vi, all) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold bg-latte/30 text-catcha-chocolate"
                  >
                    <Icon name="doc" size={12} />
                    {all.length > 1 ? `สมุดวัคซีน ${vi + 1}` : "ดูสมุดวัคซีน"}
                  </a>
                ))}
                {b.consentAcceptedAt && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                      b.fleaTickTreated
                        ? "bg-ok/20 text-ok"
                        : "bg-wait/20 text-wait"
                    }`}
                  >
                    <Icon name={b.fleaTickTreated ? "check" : "alert"} size={12} />
                    {b.fleaTickTreated ? "ยืนยันหยดยาแล้ว" : "ไม่ได้ติ๊กว่าหยดยา"}
                  </span>
                )}
              </div>
              {b.careNote && (
                <p className="mt-2 flex gap-1.5 rounded-catcha-sm border border-honey/40 bg-honey/10 px-2.5 py-2 text-[11px] text-brown">
                  <Icon name="doc" size={14} className="mt-px text-brown-soft" />
                  <span className="min-w-0 flex-1">{b.careNote}</span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * ประวัติใช้บริการ — รวมรายการที่บันทึกไว้กับนัดที่ผ่านมาเป็นไทม์ไลน์เดียว เรียงใหม่ก่อน
 *
 * ลูกค้าเก่าบางรายมีเป็นร้อยแถวและส่วนใหญ่เป็นนัดที่ยกเลิก เลยพับนัดที่ยกเลิก
 * ไว้ต่างหาก และโชว์แค่ 8 แถวแรกก่อน กดดูทั้งหมดได้
 */
function ServiceHistorySection({
  customerId,
  services,
  pastBookings,
  onChanged,
}: {
  customerId: string;
  services: { id: string; service: string; date: string; amount?: number; catName: string }[];
  pastBookings: EditableBooking[];
  onChanged: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  const remove = async (label: string, req: () => Promise<unknown>) => {
    if (!confirm(label)) return;
    await req();
    onChanged();
  };

  type Row = { key: string; date: string; text: string; onDelete: () => void };

  const serviceRows: Row[] = services.map((s) => ({
    key: `s${s.id}`,
    date: s.date,
    text: `${s.catName} · ${tidyServiceText(s.service)}${s.amount ? ` · ${s.amount} บาท` : ""}`,
    onDelete: () =>
      remove("ลบรายการนี้ออกจากประวัติ? กู้คืนไม่ได้", () =>
        fetch("/api/customers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: customerId,
            action: "delete_service_record",
            serviceId: s.id,
          }),
        })
      ),
  }));

  // นัดบ้านเดียวกัน นัดเดียวกัน (สถานะเดียวกัน) = 1 แถว ใส่ชื่อทุกตัว
  const bookingRow = (group: EditableBooking[]): Row => {
    const b = group[0];
    return {
      key: `b${group.map((g) => g.id).join(",")}`,
      date: b.date,
      text: `${group.map((g) => g.catName).join(", ")} · ${
        b.service === "room" ? "ห้องพัก" : "อาบน้ำ"
      } · ${statusLabel(b.status)}`,
      onDelete: () =>
        remove(
          group.length > 1
            ? `ลบนัดนี้ทั้งบ้าน (${group.length} ตัว) ทิ้งถาวร? กู้คืนไม่ได้`
            : "ลบนัดนี้ทิ้งถาวร? กู้คืนไม่ได้",
          () =>
            Promise.all(
              group.map((g) =>
                fetch("/api/bookings", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: g.id, action: "delete" }),
                })
              )
            )
        ),
    };
  };
  const groupRows = (list: EditableBooking[]) => {
    const byStatus = new Map<string, EditableBooking[]>();
    for (const b of list) byStatus.set(b.status, [...(byStatus.get(b.status) || []), b]);
    return Array.from(byStatus.values()).flatMap((l) => groupHousehold(l)).map(bookingRow);
  };

  const byDateDesc = (a: Row, b: Row) => b.date.localeCompare(a.date);
  const cancelledRows = groupRows(pastBookings.filter((b) => b.status === "cancelled")).sort(
    byDateDesc
  );
  const rows = [
    ...serviceRows,
    ...groupRows(pastBookings.filter((b) => b.status !== "cancelled")),
  ].sort(byDateDesc);

  const visible = showAll ? rows : rows.slice(0, 8);

  const rowList = (list: Row[]) => (
    <ul className="divide-y divide-catcha-line rounded-catcha-sm border border-catcha-line text-xs">
      {list.map((r) => (
        <li key={r.key} className="flex min-h-[48px] items-center gap-2 py-1.5 pl-3 pr-1.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold text-brown">{r.text}</span>
            <span className="block text-[11px] text-brown-faint">{r.date}</span>
          </span>
          <MoreMenu items={[{ label: "ลบรายการนี้", icon: "trash", danger: true, onClick: r.onDelete }]} />
        </li>
      ))}
    </ul>
  );

  return (
    <section className="mb-4 rounded-catcha bg-card p-4 shadow-catcha-sm">
      <CardHeader
        icon="receipt"
        title="ประวัติใช้บริการ"
        right={
          rows.length > 0 ? (
            <span className="shrink-0 text-[11px] font-bold text-brown-faint">{rows.length} รายการ</span>
          ) : undefined
        }
      />

      {rows.length === 0 ? (
        <EmptyState icon="receipt" title="ยังไม่มีประวัติ" />
      ) : (
        <>
          {rowList(visible)}
          {rows.length > visible.length && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-2 min-h-[40px] w-full rounded-catcha-sm bg-paper py-2 text-xs font-extrabold text-latte-deep"
            >
              ดูทั้งหมดอีก {rows.length - visible.length} รายการ
            </button>
          )}
        </>
      )}

      {cancelledRows.length > 0 && (
        <div className="mt-3 border-t border-catcha-line pt-2">
          <button
            type="button"
            onClick={() => setShowCancelled((v) => !v)}
            className="flex min-h-[40px] w-full items-center gap-1.5 text-left text-xs font-bold text-brown-faint"
          >
            <Icon
              name="chevron"
              size={14}
              className={`transition ${showCancelled ? "rotate-90" : ""}`}
            />
            นัดที่ยกเลิก ({cancelledRows.length})
          </button>
          {showCancelled && <div className="mt-2">{rowList(cancelledRows)}</div>}
        </div>
      )}

      <p className="mt-2 text-[10px] text-brown-faint">
        ลงข้อมูลผิด? กด ⋯ ที่รายการเพื่อลบ — จะหายจากประวัติที่ลูกค้าเห็นในแอปด้วย
      </p>
    </section>
  );
}

/**
 * ประวัติคอร์ส — ซื้อเมื่อไหร่ ใช้ไปครั้งไหนบ้าง
 *
 * ยกเลิกการซื้อ = คอร์สหายไปทั้งใบ · ยกเลิกการใช้ = ถอนบิลใบนั้นออกจากสถานะจ่ายแล้ว
 * แล้วครั้งที่หักไปจะเด้งกลับเข้าคอร์สให้เอง (ดู revertInvoicePaid)
 */
function PackageHistorySection({
  customerId,
  usage,
  onChanged,
}: {
  customerId: string;
  usage: PackageUsageRecord[];
  onChanged: () => void;
}) {
  const [packages, setPackages] = useState<
    {
      id: string;
      name: string;
      totalUses: number;
      usedUses: number;
      price?: number;
      status: string;
      createdAt?: string;
    }[]
  >([]);
  const [busy, setBusy] = useState("");

  const load = useCallback(() => {
    fetch(`/api/packages?customerId=${customerId}`)
      .then((r) => r.json())
      .then((d) => setPackages(d.packages || []))
      .catch(() => {});
  }, [customerId]);
  useEffect(() => {
    load();
  }, [load]);

  // ไม่เคยมีคอร์สเลยก็ไม่ต้องโชว์ช่องเปล่าให้รก
  if (!packages.length && !usage.length) return null;

  const cancelPurchase = async (id: string, name: string) => {
    if (!confirm(`ยกเลิกคอร์ส "${name}"? ลูกค้าจะใช้ครั้งที่เหลือไม่ได้อีก`)) return;
    setBusy(id);
    try {
      await fetch("/api/packages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "cancel" }),
      });
      load();
      onChanged();
    } finally {
      setBusy("");
    }
  };

  const cancelUse = async (invoiceId: string) => {
    if (
      !confirm(
        "ยกเลิกการใช้ครั้งนี้?\nบิลใบนี้จะกลับไปเป็น 'ยังไม่จ่าย' และครั้งที่หักไปจะคืนเข้าคอร์สให้ค่ะ"
      )
    )
      return;
    setBusy(invoiceId);
    try {
      await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoiceId, action: "unmark_paid" }),
      });
      load();
      onChanged();
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="mb-4 rounded-catcha bg-card p-4 shadow-catcha-sm">
      <CardHeader icon="ticket" title="ประวัติคอร์ส / แพ็กเกจ" />

      <SectionLabel>Purchases · การซื้อ</SectionLabel>
      <ul className="mb-4 divide-y divide-catcha-line rounded-catcha-sm border border-catcha-line text-xs text-brown-soft">
        {packages.map((p) => {
          const cancelled = p.status === "cancelled";
          return (
            <li
              key={p.id}
              className={`flex min-h-[52px] items-center gap-2 py-2 pl-3 pr-1.5 ${
                cancelled ? "line-through opacity-60" : ""
              }`}
            >
              <span className="min-w-0 flex-1">
                <b className="text-brown">{p.name}</b>{" "}
                <span className="text-brown-faint">
                  ({p.usedUses}/{p.totalUses} ครั้ง)
                </span>
                <span className="block text-[10px] text-brown-faint">
                  {p.createdAt ? p.createdAt.slice(0, 10) : "—"}
                  {p.price ? ` · ${p.price.toLocaleString()} บาท` : ""}
                </span>
              </span>
              {!cancelled && (
                <MoreMenu
                  items={[
                    {
                      label: "ยกเลิกคอร์สนี้",
                      icon: "x",
                      danger: true,
                      disabled: busy === p.id,
                      onClick: () => cancelPurchase(p.id, p.name),
                    },
                  ]}
                />
              )}
            </li>
          );
        })}
        {!packages.length && <li className="px-3 py-3 text-brown-faint">ยังไม่เคยซื้อคอร์ส</li>}
      </ul>

      <SectionLabel>Usage · การใช้</SectionLabel>
      <ul className="divide-y divide-catcha-line rounded-catcha-sm border border-catcha-line text-xs text-brown-soft">
        {usage.map((u) => (
          <li key={u.invoiceId} className="flex min-h-[48px] items-center gap-2 py-1.5 pl-3 pr-1.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold text-brown">{u.description}</span>
              <span className="block text-[11px] text-brown-faint">{u.date}</span>
            </span>
            <MoreMenu
              items={[
                {
                  label: "คืนครั้ง (ยกเลิกการใช้)",
                  icon: "back",
                  danger: true,
                  disabled: busy === u.invoiceId,
                  onClick: () => cancelUse(u.invoiceId),
                },
              ]}
            />
          </li>
        ))}
        {!usage.length && <li className="px-3 py-3 text-brown-faint">ยังไม่เคยหักครั้งจากคอร์ส</li>}
      </ul>
    </section>
  );
}

function MemberCreditHistorySection({
  customerId,
  memberCredit,
  topups,
  usage,
  onChanged,
}: {
  customerId: string;
  memberCredit: number;
  topups: MemberTopupRecord[];
  usage: MemberCreditUsageRecord[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState("");

  /**
   * ยกเลิกรายการเติม — ถอนเครดิตออกและลบรายรับที่ลงคู่กันไว้
   * ถ้าลูกค้าใช้เครดิตไปแล้วบางส่วน เซิร์ฟเวอร์จะบล็อกและบอกให้ไปยกเลิกบิลก่อน
   */
  const cancelTopup = async (t: MemberTopupRecord) => {
    const label = t.isCancelCredit
      ? "เครดิตจากบิลยกเลิกนัด"
      : t.isLegacy
        ? "ยอดยกมา"
        : "การเติมเครดิต";
    if (
      !confirm(
        `ยกเลิก${label} +${t.creditAdded.toLocaleString()} บาท?\n` +
          `เครดิตลูกค้าจะถูกหักออก ${t.creditAdded.toLocaleString()} บาท` +
          (t.isLegacy || t.isCancelCredit ? "" : " และลบรายรับที่ลงไว้ด้วย") +
          "\nกู้คืนไม่ได้"
      )
    )
      return;
    setBusy(t.id);
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customerId, action: "cancel_topup", topupId: t.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(`ยกเลิกแล้ว — เครดิตคงเหลือ ${(data.balance ?? 0).toLocaleString()} บาท`, "success");
        onChanged();
      } else if (data.error === "credit_spent") {
        toast(
          `ยกเลิกไม่ได้ — ลูกค้าใช้เครดิตไปแล้ว (เหลือ ${(data.balance ?? 0).toLocaleString()} จากที่เติม ${(data.creditAdded ?? 0).toLocaleString()}) · ยกเลิกบิลที่ใช้เครดิตก่อน แล้วค่อยมายกเลิกรายการนี้`,
          "error"
        );
      } else {
        toast("ยกเลิกไม่สำเร็จ", "error");
      }
    } finally {
      setBusy("");
    }
  };

  const totalToppedUp = topups.reduce((s, t) => s + t.creditAdded, 0);
  const totalUsed = usage.reduce((s, u) => s + u.amount, 0);

  type LedgerRow =
    | { kind: "topup"; at: string; topup: MemberTopupRecord }
    | { kind: "usage"; at: string; usage: MemberCreditUsageRecord };

  const ledger: LedgerRow[] = [
    ...topups.map((t) => ({ kind: "topup" as const, at: t.createdAt, topup: t })),
    ...usage.map((u) => ({ kind: "usage" as const, at: u.at, usage: u })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (!topups.length && !usage.length && memberCredit <= 0) return null;

  return (
    <section className="mb-4 rounded-catcha bg-card p-4 shadow-catcha-sm">
      <CardHeader icon="doc" title="ประวัติเครดิต Member" />
      <p className="-mt-1 mb-3 text-[11px] text-brown-soft">
        คงเหลือ{" "}
        <span className="font-bold text-latte-deep">{memberCredit.toLocaleString()} บาท</span>
        {totalToppedUp > 0 && (
          <>
            {" · "}
            เติมรวม {totalToppedUp.toLocaleString()} บาท
          </>
        )}
        {totalUsed > 0 && (
          <>
            {" · "}
            ใช้ไป {totalUsed.toLocaleString()} บาท
          </>
        )}
      </p>

      {ledger.length === 0 ? (
        <EmptyState icon="wallet" title="ยังไม่มีประวัติเติม/ใช้เครดิต" />
      ) : (
        <ul className="divide-y divide-catcha-line rounded-catcha-sm border border-catcha-line">
          {ledger.map((row) =>
            row.kind === "topup" ? (
              <li key={row.topup.id} className="py-2.5 pl-3 pr-1.5 text-xs">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ok/15 text-ok">
                    <Icon
                      name={row.topup.isCancelCredit ? "back" : row.topup.isLegacy ? "clock" : "plus"}
                      size={16}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`font-bold ${
                        row.topup.isLegacy || row.topup.isCancelCredit ? "text-brown" : "text-ok"
                      }`}
                    >
                      {row.topup.isCancelCredit
                        ? "ยกเลิกนัด เก็บยอดเป็นเครดิต"
                        : row.topup.isLegacy
                          ? "ยอดยกมาจากระบบเก่า"
                          : "เติมเครดิต"}
                    </p>
                    {row.topup.isCancelCredit ? (
                      <p className="text-brown-soft">
                        {row.topup.createdAt.slice(0, 10)}
                        {row.topup.sourceInvoiceId && (
                          <>
                            {" · จากบิล "}
                            <span className="font-bold text-latte-deep">{row.topup.sourceInvoiceId}</span>
                          </>
                        )}
                        {" · ไม่นับรายรับ · ไม่ให้แต้มซ้ำ"}
                      </p>
                    ) : (
                      <p className="text-brown-soft">
                        {row.topup.createdAt.slice(0, 10)} · รับ {row.topup.paidAmount.toLocaleString()} บาท
                        {row.topup.bonusAmount > 0 && (
                          <> · แถม {row.topup.bonusAmount.toLocaleString()} บาท</>
                        )}
                        {row.topup.isLegacy && <> · ไม่นับรายรับ</>}
                      </p>
                    )}
                    {row.topup.note && (
                      <p className="text-[10px] text-brown-faint">{row.topup.note}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-extrabold text-ok">
                      +{row.topup.creditAdded.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-brown-faint">
                      คงเหลือ {row.topup.balanceAfter.toLocaleString()}
                    </p>
                  </div>
                  <MoreMenu
                    items={[
                      {
                        label: busy === row.topup.id ? "กำลังยกเลิก…" : "ยกเลิกรายการนี้",
                        icon: "trash",
                        danger: true,
                        disabled: busy === row.topup.id,
                        onClick: () => cancelTopup(row.topup),
                      },
                    ]}
                  />
                </div>
              </li>
            ) : (
              <li key={row.usage.id} className="px-3 py-2.5 text-xs">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-wait/15 text-wait">
                    <Icon name="receipt" size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-wait">ใช้เครดิต</p>
                    <p className="text-brown-soft">
                      {row.usage.date} · {row.usage.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-extrabold text-wait">
                      −{row.usage.amount.toLocaleString()}
                    </p>
                    {/* รายการนี้สร้างจากบิลที่จ่ายด้วยเครดิต ลบเดี่ยวๆ ไม่ได้
                        ต้องไปกด "ยกเลิกการชำระ" ที่บิล ซึ่งคืนเครดิตให้อัตโนมัติอยู่แล้ว */}
                    <p className="mt-0.5 text-[9px] text-brown-faint">
                      ยกเลิกที่บิล → คืนเครดิตอัตโนมัติ
                    </p>
                  </div>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </section>
  );
}

function CustomerSummaryCard({
  customer,
  points,
  visits,
  lastVisitDate,
  daysSinceVisit,
  inactive,
  canFollowUp,
  onSaved,
  toolsSlot,
}: {
  customer: CustomerRecord;
  points: number;
  visits: number;
  lastVisitDate?: string | null;
  daysSinceVisit?: number | null;
  inactive?: boolean;
  canFollowUp?: boolean;
  onSaved: () => void;
  /** ที่วางฟอร์มเพิ่มแต้ม/ขายคอร์สท้ายหน้า (ย้ายลงล่างให้หัวโปรไฟล์ไม่รก) */
  toolsSlot?: HTMLElement | null;
}) {
  const [tier, setTier] = useState<CustomerTier>(customer.tier || "new");
  const [msg, setMsg] = useState("");
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [followUpPreview, setFollowUpPreview] = useState<Record<string, unknown>[] | null>(null);
  const { config: siteConfig } = useConfig();
  const followUpOn = isFeatureOn(siteConfig, "followUp");
  const [addAmt, setAddAmt] = useState("");
  const [addReason, setAddReason] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  /** ค่าเริ่มต้น = ไม่แจ้ง — เพิ่มแต้มหลังบ้านไม่ต้องรบกวนลูกค้า */
  const [addNotify, setAddNotify] = useState(false);

  /** การ์ดที่รอยืนยันก่อนส่งจริง — null = ยังไม่ได้กดพรีวิว */
  const [pointsPreview, setPointsPreview] = useState<Record<string, unknown>[] | null>(null);

  const pointsPayload = () => ({
    action: "admin_add",
    lineUserId: customer.lineUserId,
    customerId: customer.id,
    amount: Math.round(Number(addAmt) || 0),
    reason: addReason.trim() || "แต้มพิเศษจากร้าน",
    displayName: customer.name,
  });

  /** ติ๊กแจ้งลูกค้า → ขอตัวอย่างการ์ดมาดูก่อน ยังไม่เติมแต้มจริง */
  const previewBonusPoints = async () => {
    const n = Math.round(Number(addAmt) || 0);
    if (!n || !customer.lineUserId) return;
    setAddBusy(true);
    try {
      const res = await fetch("/api/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pointsPayload(), preview: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.preview) setPointsPreview(data.preview);
      else toast("ดูตัวอย่างไม่สำเร็จ", "error");
    } finally {
      setAddBusy(false);
    }
  };

  const addBonusPoints = async () => {
    const n = Math.round(Number(addAmt) || 0);
    if (!n || !customer.lineUserId) return;
    const reason = addReason.trim() || "แต้มพิเศษจากร้าน";
    setAddBusy(true);
    try {
      const res = await fetch("/api/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pointsPayload(), reason, notify: addNotify }),
      });
      setPointsPreview(null);
      if (res.ok) {
        toast(
          `${n > 0 ? "เพิ่ม" : "ปรับ"} ${n} แต้มแล้ว (${reason})` +
            (n > 0 && !addNotify ? " · ไม่ได้แจ้งลูกค้า" : "")
        );
        setAddAmt("");
        setAddReason("");
        onSaved();
      } else {
        toast("เพิ่มแต้มไม่สำเร็จ", "error");
      }
    } finally {
      setAddBusy(false);
    }
  };

  // ── คอร์ส/แพ็กเกจ ──
  const [packages, setPackages] = useState<
    {
      id: string;
      name: string;
      totalUses: number;
      usedUses: number;
      status: string;
      groomProgram?: string;
      planId?: string;
      locked?: boolean;
      outstanding?: number;
    }[]
  >([]);
  /** แผนแบ่งจ่ายของคอร์ส (id แผน → งวด/ยอดค้าง) */
  const [pkgPlans, setPkgPlans] = useState<
    Record<string, { installments: number; installmentsLeft: number; nextInstallment: number; paid: number; price: number; payments: unknown[] }>
  >({});
  const [pkgInstallments, setPkgInstallments] = useState(1);
  const [pkgFirstPay, setPkgFirstPay] = useState("");
  const [pkgMethod, setPkgMethod] = useState<"transfer" | "cash">("transfer");
  const [pkgName, setPkgName] = useState("");
  /** "" = ใช้ได้ทุกโปรแกรม */
  const [pkgProgram, setPkgProgram] = useState("");
  const groomPrograms = useGroomPrograms();
  /** อาบน้ำ (นับครั้ง) / ห้องพัก (นับคืน แยกห้อง) / ชุดรวม (หลายรายการ) */
  const [pkgMode, setPkgMode] = useState<"use" | "night" | "bundle">("use");
  const rooms = useRoomOptions();
  /** "" = ใช้ได้ทุกห้อง */
  const [pkgRoom, setPkgRoom] = useState("");
  const [pkgFree, setPkgFree] = useState("");
  const [pkgItems, setPkgItems] = useState<OfferItemDraft[]>([]);
  const [pkgUses, setPkgUses] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgBusy, setPkgBusy] = useState(false);
  /** ค่าเริ่มต้น = ไม่แจ้ง / ไม่ใช่ยอดยกมา — เหมือนฝั่งเติมเครดิต Member */
  const [pkgNotify, setPkgNotify] = useState(false);
  const [pkgLegacy, setPkgLegacy] = useState(false);
  const [pkgPreview, setPkgPreview] = useState<Record<string, unknown>[] | null>(null);

  /** ครั้งที่ยังใช้ได้รวมทุกคอร์ส (ไม่นับที่ยกเลิก/ใช้หมดแล้ว) */
  const packageUsesLeft = packages
    .filter((p) => p.status === "active")
    .reduce((n, p) => n + Math.max(0, p.totalUses - p.usedUses), 0);

  const loadPackages = useCallback(() => {
    fetch(`/api/packages?customerId=${customer.id}`)
      .then((r) => r.json())
      .then((d) => setPackages(d.packages || []))
      .catch(() => {});
    fetch(`/api/room-plans?customerId=${customer.id}`)
      .then((r) => r.json())
      .then((d) => {
        const map: typeof pkgPlans = {};
        for (const p of d.plans || []) if (p.kind === "package") map[p.id] = p;
        setPkgPlans(map);
      })
      .catch(() => {});
  }, [customer.id]);
  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  /** รายการในคอร์ส — คอร์สอาบน้ำไม่มีแถม = แบบเดิม (ไม่ส่งรายการ) */
  const pkgItemsPayload = () => {
    const paid = Math.max(0, Math.round(Number(pkgUses) || 0));
    const free = Math.max(0, Math.round(Number(pkgFree) || 0));
    if (pkgMode === "bundle") return itemsToPayload(pkgItems);
    if (pkgMode === "night")
      return paid + free > 0 ? [{ unit: "night" as const, paid, free, roomType: pkgRoom || undefined }] : [];
    return free > 0 ? [{ unit: "use" as const, paid, free, groomProgram: pkgProgram || undefined }] : undefined;
  };
  const pkgTotal = () => {
    const items = pkgItemsPayload();
    return items ? items.reduce((n, it) => n + it.paid + it.free, 0) : Math.round(Number(pkgUses) || 0);
  };

  const packagePayload = () => {
    const price = Math.round(Number(pkgPrice) || 0);
    return {
      customerId: customer.id,
      name: pkgName.trim(),
      totalUses: pkgTotal(),
      items: pkgItemsPayload(),
      price,
      isLegacy: pkgLegacy,
      notify: pkgNotify,
      groomProgram: pkgProgram || undefined,
      installments: pkgLegacy ? 1 : pkgInstallments,
      firstPayment: !pkgLegacy && pkgInstallments > 1 ? Math.round(Number(pkgFirstPay) || 0) : undefined,
      paymentMethod: pkgMethod,
    };
  };

  const sellPackage = async () => {
    if (!pkgName.trim() || pkgTotal() <= 0) return;
    setPkgBusy(true);
    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packagePayload()),
      });
      const pkgData = await res.json().catch(() => ({}));
      setPkgPreview(null);
      if (!res.ok && pkgData.error) {
        toast(pkgData.error, "error");
        loadPackages();
      }
      if (res.ok) {
        toast(
          `${pkgLegacy ? "ยกคอร์ส" : "ขายคอร์ส"} "${pkgName.trim()}" แล้ว` +
            (pkgLegacy ? " · ไม่นับรายรับเดือนนี้" : "") +
            (pkgData.plan
              ? pkgData.plan.remaining > 0
                ? ` · ค้าง ${Math.round(pkgData.plan.remaining).toLocaleString()} บาท (ใช้ได้เมื่อจ่ายครบ)`
                : " · จ่ายครบแล้ว"
              : "") +
            (pkgNotify
              ? pkgData.notifyError
                ? ` · ⚠️ ส่ง LINE ไม่ได้: ${pkgData.notifyError}`
                : " · แจ้งลูกค้าแล้ว 💬"
              : "")
        );
        setPkgName("");
        setPkgProgram("");
        setPkgRoom("");
        setPkgFree("");
        setPkgItems([]);
        setPkgUses("");
        setPkgPrice("");
        setPkgLegacy(false);
        setPkgNotify(false);
        setPkgInstallments(1);
        setPkgFirstPay("");
        loadPackages();
      }
    } finally {
      setPkgBusy(false);
    }
  };

  const previewPackage = async () => {
    if (!pkgName.trim() || pkgTotal() <= 0) return;
    setPkgBusy(true);
    try {
      const res = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...packagePayload(), preview: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.preview)) {
        setPkgPreview(data.preview);
      } else {
        toast("ดูตัวอย่างการ์ดไม่สำเร็จ", "error");
      }
    } finally {
      setPkgBusy(false);
    }
  };

  const cancelPackage = async (id: string) => {
    const pk = packages.find((p) => p.id === id);
    const plan = pk?.planId ? pkgPlans[pk.planId] : undefined;
    if (
      !confirm(
        plan
          ? "ยกเลิกคอร์สนี้? ยอดค้างจะไม่ต้องจ่ายต่อ (เงินงวดที่รับแล้วไม่ถูกลบ ต้องคืนลูกค้าเองถ้าจะคืน)"
          : "ยกเลิกคอร์สนี้?"
      )
    )
      return;
    if (pk?.planId && plan) {
      await fetch("/api/room-plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", planId: pk.planId }),
      });
    } else {
      await fetch("/api/packages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", packageId: id }),
      });
    }
    loadPackages();
  };

  /** รับเงินงวดของคอร์สแบ่งจ่าย */
  const payInstallment = async (planId: string, name: string) => {
    const plan = pkgPlans[planId];
    if (!plan) return;
    const remaining = plan.price - plan.paid;
    const raw = prompt(
      `รับเงินงวด — ${name}\nค้าง ${Math.round(remaining).toLocaleString()} บาท · เหลือ ${plan.installmentsLeft} งวด\n\nรับรอบนี้กี่บาท?`,
      String(plan.nextInstallment || "")
    );
    if (raw == null) return;
    const amount = Math.round(Number(raw.replace(/[,\s฿]/g, "")) || 0);
    if (amount <= 0) return;
    const method = confirm("รับเป็นเงินสดใช่ไหม?\n(ตกลง = เงินสด · ยกเลิก = โอน)") ? "cash" : "transfer";
    const res = await fetch("/api/room-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pay", planId, amount, paymentMethod: method, notify: customer.lineUserId ? undefined : false }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok && d.ok) {
      toast(
        d.plan.remaining > 0
          ? `รับแล้ว ${amount.toLocaleString()} บาท · ค้างอีก ${Math.round(d.plan.remaining).toLocaleString()} บาท`
          : `รับครบแล้ว — คอร์สใช้ได้แล้ว`
      );
      loadPackages();
    } else if (d.error === "over_due") {
      toast(`เกินยอดค้าง — ค้างอยู่ ${Math.round(d.due).toLocaleString()} บาท`, "error");
    } else {
      toast("รับเงินไม่สำเร็จ", "error");
    }
  };

  const heroCat = customer.cats.find((cat) => cat.photoDataUrl) || customer.cats[0];

  useEffect(() => {
    setTier(customer.tier || "new");
  }, [customer.id, customer.tier]);

  const removeCustomer = async () => {
    if (
      !confirm(
        `ลบลูกค้า "${customer.name}" และประวัติทั้งหมด (แมว/นัด/แต้ม)?\nลบแล้วกู้คืนไม่ได้`
      )
    )
      return;
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: customer.id, action: "delete_customer" }),
    });
    if (res.ok) onSaved();
    else setMsg("ลบไม่สำเร็จ");
  };

  const [mergeOpen, setMergeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const unlinkLine = async () => {
    if (
      !confirm(
        `ปลดผูก LINE ของ "${customer.name}"?\n\n` +
          `หลังปลด: ส่งลิงก์เชิญให้ลูกค้ากดผูกใหม่ได้เลย (ไม่ติด "ผูกไปแล้ว")\n` +
          `แต้ม · คูปอง · บิล · แมว ยังอยู่ครบ ไม่หายไปไหน\n\n` +
          `⚠️ ระหว่างที่ยังไม่ผูกใหม่ ลูกค้าจะไม่ได้รับข้อความจากร้าน`
      )
    )
      return;
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: customer.id, action: "unlink_line" }),
    });
    if (res.ok) {
      toast("ปลดผูก LINE แล้ว — ส่งลิงก์เชิญให้ลูกค้าผูกใหม่ได้เลย 🔓", "success");
      onSaved();
    } else {
      toast("ปลดผูกไม่สำเร็จ", "error");
    }
  };

  const setTierManual = async (t: CustomerTier) => {
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customer.id,
        action: "set_tier",
        tier: t,
      }),
    });
    if (res.ok) {
      setTier(t);
      setMsg("✅ อัปเดตระดับแล้ว");
      onSaved();
      setTimeout(() => setMsg(""), 2000);
    }
  };

  const recalcTier = async () => {
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customer.id,
        action: "recalculate_tier",
      }),
    });
    const data = await res.json();
    if (res.ok && data.customer?.tier) {
      setTier(data.customer.tier);
      setMsg("✅ คำนวณระดับใหม่แล้ว");
      onSaved();
      setTimeout(() => setMsg(""), 2000);
    }
  };

  /** กดปุ่ม → ดูตัวอย่างการ์ดที่ลูกค้าจะเห็นก่อน แล้วค่อยยืนยันส่ง */
  const previewFollowUp = async () => {
    if (!customer.lineUserId) {
      setMsg("❌ ลูกค้ายังไม่ได้ผูก LINE");
      return;
    }
    setFollowUpBusy(true);
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customer.id, action: "send_follow_up", preview: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.preview)) {
        setFollowUpPreview(data.preview);
      } else {
        setMsg(`❌ ${data.error || "ดูตัวอย่างการ์ดไม่สำเร็จ"}`);
        setTimeout(() => setMsg(""), 3000);
      }
    } finally {
      setFollowUpBusy(false);
    }
  };

  const sendFollowUp = async () => {
    setFollowUpBusy(true);
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customer.id,
        action: "send_follow_up",
        // ส่งเพราะร้านกดเอง ดูการ์ดแล้ว — ไม่ต้องติดเงื่อนไข "ไม่ส่งซ้ำภายใน X วัน" ของระบบส่งอัตโนมัติ
        force: !canFollowUp,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setFollowUpBusy(false);
    setFollowUpPreview(null);
    if (res.ok) {
      setMsg("✅ ส่งการ์ดทักลูกค้าแล้ว");
      onSaved();
    } else {
      setMsg(`❌ ${data.error || "ส่งไม่สำเร็จ"}`);
    }
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <section className="mb-4 rounded-catcha bg-gradient-to-br from-honey/45 via-card to-latte/15 p-4 shadow-catcha">
      {msg && (
        <p className="mb-3 rounded-catcha-sm bg-sage/25 px-3 py-2 text-center text-xs font-extrabold text-ok">
          {msg}
        </p>
      )}
      <div className="mb-3 flex items-start gap-3">
        {heroCat?.photoDataUrl ? (
          <CatPhoto src={heroCat.photoDataUrl} name={heroCat.name} size={64} />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-catcha-sm bg-card/80 text-catcha-chocolate ring-2 ring-white/70">
            <Icon name={customer.cats.length > 0 ? "paw" : "user"} size={28} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Customer · ลูกค้า</p>
          <h1 className="mt-0.5 break-words text-xl font-extrabold leading-tight text-catcha-chocolate">
            {customer.name}
          </h1>
          {customer.lineDisplayName && customer.lineDisplayName !== customer.name && (
            <p className="mt-0.5 truncate text-[11px] text-brown-soft">
              ชื่อใน LINE: <span className="font-bold text-brown">{customer.lineDisplayName}</span>
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${tierBadgeClass(customer.tier || "new")}`}>
              {TIER_LABELS[customer.tier || "new"]}
            </span>
            {customer.isMember && (
              <span className="inline-flex items-center gap-1 rounded-full bg-latte/30 px-2.5 py-0.5 text-[10px] font-extrabold text-latte-deep">
                <Icon name="star" size={11} />
                Member
              </span>
            )}
            {customer.lineUserId ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok/15 px-2.5 py-0.5 text-[10px] font-bold text-ok">
                <Icon name="check" size={11} strokeWidth={2.4} />
                ผูก LINE แล้ว
              </span>
            ) : (
              <span className="rounded-full bg-paper px-2.5 py-0.5 text-[10px] font-bold text-brown-faint">
                ยังไม่ผูก LINE
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          aria-label="แก้ไขข้อมูลลูกค้า"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card/80 text-catcha-chocolate ring-1 ring-catcha-line"
        >
          <Icon name="edit" size={18} />
        </button>
        <MoreMenu
          items={[
            ...(customer.lineUserId
              ? [{ label: "ปลดผูก LINE", icon: "link", danger: true, onClick: unlinkLine }]
              : []),
            { label: "รวมกับลูกค้าอื่น (บัญชีซ้ำ)", icon: "users", onClick: () => setMergeOpen(true) },
            { label: "ลบลูกค้าคนนี้", icon: "trash", danger: true, onClick: removeCustomer },
          ]}
        />
      </div>

      <ul className="mb-3 space-y-1 text-[11px] text-brown-soft">
        {customer.phone && (
          <li className="flex items-center gap-2">
            <Icon name="phone" size={14} className="text-brown-faint" />
            <a href={`tel:${customer.phone}`} className="font-bold text-brown">
              {customer.phone}
            </a>
          </li>
        )}
        {customer.email && (
          <li className="flex items-center gap-2">
            <Icon name="send" size={14} className="text-brown-faint" />
            <span className="min-w-0 truncate">{customer.email}</span>
          </li>
        )}
        {customer.birthday && (
          <li className="flex items-center gap-2">
            <Icon name="cake" size={14} className="text-brown-faint" />
            วันเกิด {customer.birthday}
          </li>
        )}
        {customer.referralSource && (
          <li className="flex items-center gap-2">
            <Icon name="sparkle" size={14} className="text-brown-faint" />
            รู้จักจาก: {customer.referralSource}
          </li>
        )}
        {customer.address && (
          <li className="flex items-start gap-2">
            <Icon name="home" size={14} className="mt-px text-brown-faint" />
            <span className="min-w-0 flex-1">
              {customer.address}
              {customer.addressMapUrl && (
                <>
                  {" "}
                  ·{" "}
                  <a
                    href={customer.addressMapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-latte-deep underline"
                  >
                    แผนที่
                  </a>
                </>
              )}
            </span>
          </li>
        )}
        <li className="flex items-center gap-2">
          <Icon name="user" size={14} className="text-brown-faint" />
          {customer.idCardUrl ? (
            <a href={customer.idCardUrl} target="_blank" rel="noreferrer" className="font-bold text-latte-deep underline">
              ดูบัตรประชาชน (ขีดทับแล้ว)
            </a>
          ) : (
            <span className="text-brown-faint">ยังไม่ได้แนบบัตรประชาชน</span>
          )}
        </li>
        <li className={`flex items-center gap-2 ${customer.marketingConsent ? "text-ok" : "font-bold text-wait"}`}>
          <Icon name={customer.marketingConsent ? "check" : "x"} size={14} />
          {customer.marketingConsent ? "ยินยอมรับข่าวสาร/โปร" : "ไม่รับข่าวสาร/โปร"}
        </li>
      </ul>

      <CustomerIntakeCards customer={customer} onDone={onSaved} />

      {inactive && (
        <p className="mb-3 flex items-center gap-2 rounded-catcha-sm bg-wait/10 px-3 py-2 text-[11px] font-bold text-wait">
          <Icon name="clock" size={14} />
          หายไป {daysSinceVisit} วัน
          {lastVisitDate ? ` · มาครั้งล่าสุด ${lastVisitDate}` : ""}
        </p>
      )}

      <div className="mb-4 grid grid-cols-4 divide-x divide-catcha-line rounded-catcha-sm bg-card/85 py-2.5 shadow-catcha-sm">
        <div className="px-1 text-center">
          <p className="text-lg font-extrabold leading-tight text-latte-deep">{points}</p>
          <p className="text-[10px] font-bold text-brown-soft">แต้ม</p>
        </div>
        <div className="px-1 text-center">
          <p className="text-lg font-extrabold leading-tight text-catcha-chocolate">{visits}</p>
          <p className="text-[10px] font-bold text-brown-soft">มา (ครั้ง)</p>
        </div>
        <div className="px-1 text-center">
          <p className="truncate text-lg font-extrabold leading-tight text-catcha-chocolate">
            {customer.memberCredit.toLocaleString()}
          </p>
          <p className="text-[10px] font-bold text-brown-soft">เครดิต (฿)</p>
        </div>
        {/* คอร์สคงเหลือ — ลูกค้าจ่ายล่วงหน้าไว้แล้ว ต้องเห็นตั้งแต่แรกว่ายังใช้ได้กี่ครั้ง */}
        <div className="px-1 text-center">
          <p className="text-lg font-extrabold leading-tight text-ok">{packageUsesLeft}</p>
          <p className="text-[10px] font-bold text-brown-soft">คอร์สเหลือ</p>
        </div>
      </div>

      {followUpOn && (inactive || customer.lineUserId) && (
        <div className="mb-3 rounded-catcha-sm border border-catcha-line bg-card/85 p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage/20 text-ok">
              <Icon name="send" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-catcha-chocolate">ทักลูกค้าทาง LINE</p>
              <p className="text-[10px] text-brown-faint">
                {!customer.lineUserId
                  ? "ต้องผูก LINE ก่อนจึงส่งได้"
                  : customer.lastFollowUpAt
                    ? `ส่งการ์ด "คิดถึงน้อง" ล่าสุด ${customer.lastFollowUpAt.slice(0, 10)}`
                    : `ส่งการ์ด "คิดถึงน้อง" ชวนกลับมาใช้บริการ · ยังไม่เคยส่ง`}
              </p>
            </div>
            <button
              type="button"
              disabled={followUpBusy || !customer.lineUserId}
              onClick={previewFollowUp}
              className="flex min-h-[40px] shrink-0 items-center gap-1 rounded-full bg-sage/25 px-3.5 py-2 text-xs font-bold text-ok disabled:opacity-50"
            >
              <Icon name="eye" size={14} />
              {followUpBusy && !followUpPreview ? "กำลังโหลด…" : customer.lastFollowUpAt ? "ดูการ์ด + ส่งอีกครั้ง" : "ดูการ์ด + ส่ง"}
            </button>
          </div>
          <a
            href="/admin/cards?card=missYou"
            className="mt-1.5 block text-right text-[10px] font-bold text-latte-deep underline"
          >
            แก้ข้อความ/หน้าตาการ์ดนี้
          </a>
        </div>
      )}

      {followUpPreview && (
        <PreviewSendModal
          messages={followUpPreview}
          sending={followUpBusy}
          onConfirm={sendFollowUp}
          onCancel={() => setFollowUpPreview(null)}
        />
      )}

      <div className="mb-3 rounded-catcha-sm border border-catcha-line bg-card/85 p-3">
        <SectionLabel
          action={
            <button
              type="button"
              onClick={recalcTier}
              className="flex min-h-[32px] items-center gap-1 text-[11px] font-bold text-latte-deep"
            >
              <Icon name="sparkle" size={13} />
              คำนวณอัตโนมัติ
            </button>
          }
        >
          Tier · ระดับลูกค้า
        </SectionLabel>
        <Segmented
          value={tier}
          onChange={setTierManual}
          options={(Object.keys(TIER_LABELS) as CustomerTier[]).map((t) => ({ id: t, label: TIER_LABELS[t] }))}
        />
      </div>

      {toolsSlot &&
        createPortal(
          <>
            <CollapsibleCard
              icon="gift"
              title="เพิ่มแต้มพิเศษ (แต้มฟรี)"
              sub={<>มีอยู่ <span className="font-bold text-latte-deep">{points} แต้ม</span></>}
            >
            {customer.lineUserId ? (
              <>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={addAmt}
                    onChange={(e) => setAddAmt(e.target.value)}
                    placeholder="กี่แต้ม"
                    className={`!w-24 shrink-0 font-bold ${inputCls}`}
                  />
                  <input
                    value={addReason}
                    onChange={(e) => setAddReason(e.target.value)}
                    placeholder="เหตุผล เช่น รีวิวร้าน"
                    className={`min-w-0 flex-1 ${inputCls}`}
                  />
                </div>
                <button
                  type="button"
                  disabled={addBusy || !addAmt}
                  onClick={addNotify ? previewBonusPoints : addBonusPoints}
                  className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-catcha-sm bg-latte-deep px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
                >
                  {!addBusy && <Icon name={addNotify ? "eye" : "plus"} size={16} />}
                  {addBusy ? "…" : addNotify ? "ดูการ์ด" : "เพิ่มแต้ม"}
                </button>
                {pointsPreview && (
                  <PreviewSendModal
                    messages={pointsPreview}
                    sending={addBusy}
                    onConfirm={addBonusPoints}
                    onCancel={() => setPointsPreview(null)}
                  />
                )}
                <label className="mt-1 flex min-h-[40px] items-center gap-2 text-[11px] font-bold text-brown-soft">
                  <input
                    type="checkbox"
                    checked={addNotify}
                    onChange={(e) => setAddNotify(e.target.checked)}
                    className="h-5 w-5 accent-latte-deep"
                  />
                  แจ้งลูกค้าทาง LINE ด้วย (เสียโควตา 1 ข้อความ)
                </label>
                <p className="text-[10px] text-brown-faint">
                  บันทึกในประวัติแต้มของลูกค้า (มีเหตุผลกำกับ) + แจ้งเตือนร้านเสมอ ·
                  ปกติจะ<b>ไม่</b>ส่งข้อความหาลูกค้า ถ้าอยากแจ้งค่อยติ๊กช่องด้านบน
                </p>
              </>
            ) : (
              <p className="flex gap-2 text-[11px] font-bold text-brown-soft">
                <Icon name="alert" size={16} className="text-wait" />
                <span className="min-w-0 flex-1">ลูกค้ารายนี้ยังไม่ได้ผูก LINE — ต้องให้ลูกค้าเปิดแอปจาก LINE ก่อน
                ถึงจะเพิ่มแต้มสะสมได้ค่ะ (แต้มผูกกับบัญชี LINE)</span>
              </p>
            )}
            </CollapsibleCard>
            <CollapsibleCard
              icon="ticket"
              title="คอร์ส / แพ็กเกจ"
              sub={
                <>
                  เหลือ <span className="font-bold text-ok">{packageUsesLeft} ครั้ง</span>
                  {packages.some((p) => p.locked && p.status !== "cancelled") && (
                    <span className="font-bold text-wait"> · มีงวดค้าง</span>
                  )}
                  {" "}· แตะเพื่อขายคอร์ส
                </>
              }
            >
            {packages.filter((p) => p.status !== "cancelled").length > 0 && (
              <ul className="mb-2 divide-y divide-catcha-line rounded-catcha-sm border border-catcha-line bg-card">
                {packages
                  .filter((p) => p.status !== "cancelled")
                  .map((p) => {
                    const left = p.totalUses - p.usedUses;
                    return (
                      <li key={p.id} className="flex min-h-[48px] items-center gap-2 py-1 pl-3 pr-1.5 text-xs">
                        <span className="min-w-0 flex-1 truncate font-bold text-brown">
                          {p.name}
                          {p.groomProgram && (
                            <span className="block truncate text-[10px] font-normal text-brown-faint">
                              ใช้กับ {groomProgramName(p.groomProgram, groomPrograms) || "โปรแกรมที่ลบไปแล้ว"}
                            </span>
                          )}
                          {p.planId && pkgPlans[p.planId] && (
                            <span className={`block truncate text-[10px] font-bold ${p.locked ? "text-wait" : "text-ok"}`}>
                              {p.locked
                                ? `🔒 จ่ายแล้ว ${pkgPlans[p.planId].payments.length}/${pkgPlans[p.planId].installments} งวด`
                                : `แบ่งจ่าย ${pkgPlans[p.planId].payments.length} งวด · จ่ายครบแล้ว`}
                            </span>
                          )}
                        </span>
                        {p.locked && p.planId ? (
                          <button
                            type="button"
                            onClick={() => payInstallment(p.planId!, p.name)}
                            className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-full bg-catcha-chocolate px-3 text-[11px] font-extrabold text-card"
                          >
                            <Icon name="money" size={14} />
                            รับงวด · ค้าง {Math.round(p.outstanding || 0).toLocaleString()}
                          </button>
                        ) : (
                          <span className={`shrink-0 font-extrabold ${left > 0 ? "text-ok" : "text-brown-faint"}`}>
                            เหลือ {left}/{p.totalUses}
                          </span>
                        )}
                        <MoreMenu
                          items={[
                            { label: "ยกเลิกคอร์สนี้", icon: "x", danger: true, onClick: () => cancelPackage(p.id) },
                          ]}
                        />
                      </li>
                    );
                  })}
              </ul>
            )}
            <Segmented
              value={pkgMode}
              onChange={(m) => {
                setPkgMode(m);
                if (m === "bundle" && !pkgItems.length)
                  setPkgItems([emptyItem("night", rooms, groomPrograms), emptyItem("use", rooms, groomPrograms)]);
              }}
              className="mb-2"
              options={[
                { id: "use", label: "อาบน้ำ" },
                { id: "night", label: "ห้องพัก" },
                { id: "bundle", label: "ชุดรวม" },
              ]}
            />
            <input
              value={pkgName}
              onChange={(e) => setPkgName(e.target.value)}
              placeholder={
                pkgMode === "night"
                  ? "ชื่อคอร์ส เช่น พัก Mid Cozy 10 คืน"
                  : pkgMode === "bundle"
                    ? "ชื่อคอร์ส เช่น พัก 5 คืน + อาบน้ำ 6 ครั้ง"
                    : "ชื่อคอร์ส เช่น อาบน้ำ 10 ครั้ง"
              }
              className={inputCls}
            />
            {pkgMode === "bundle" ? (
              <div className="mt-2">
                <OfferItemsEditor items={pkgItems} onChange={setPkgItems} rooms={rooms} programs={groomPrograms} />
              </div>
            ) : (
              <div className="mt-2">
                {pkgMode === "night" ? (
                  <RoomTypePicker
                    value={pkgRoom}
                    onChange={setPkgRoom}
                    rooms={rooms}
                    nights={Number(pkgUses) || undefined}
                    price={Number(pkgPrice) || undefined}
                    onPrice={(v) => setPkgPrice(String(v))}
                  />
                ) : (
                  <GroomProgramPicker value={pkgProgram} onChange={setPkgProgram} programs={groomPrograms} />
                )}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              {pkgMode !== "bundle" && (
                <>
                  <label className="block w-20 shrink-0 text-[10px] font-bold text-brown-soft">
                    {pkgMode === "night" ? "กี่คืน" : "กี่ครั้ง"}
                    <input
                      type="number"
                      value={pkgUses}
                      onChange={(e) => setPkgUses(e.target.value)}
                      placeholder={pkgMode === "night" ? "กี่คืน" : "กี่ครั้ง"}
                      className={`mt-0.5 ${inputCls}`}
                    />
                  </label>
                  <label className="block w-20 shrink-0 text-[10px] font-bold text-brown-soft">
                    แถมฟรี
                    <input
                      type="number"
                      value={pkgFree}
                      onChange={(e) => setPkgFree(e.target.value)}
                      placeholder="0"
                      className={`mt-0.5 ${inputCls}`}
                    />
                  </label>
                </>
              )}
              <label className="block min-w-0 flex-1 text-[10px] font-bold text-brown-soft">
                {pkgMode === "bundle" ? "ราคาทั้งชุด (บาท)" : "ราคา (บาท)"}
                <input
                  type="number"
                  value={pkgPrice}
                  onChange={(e) => setPkgPrice(e.target.value)}
                  placeholder={pkgMode === "bundle" ? "ราคาทั้งชุด (บาท)" : "ราคา (บาท)"}
                  className={`mt-0.5 ${inputCls}`}
                />
              </label>
            </div>

            {!pkgLegacy && (
              <div className="mt-2 space-y-2">
                <select
                  value={pkgInstallments}
                  onChange={(e) => setPkgInstallments(Number(e.target.value))}
                  className={inputCls}
                  aria-label="การจ่ายเงิน"
                >
                  <option value={1}>จ่ายเต็มครั้งเดียว</option>
                  {Array.from({ length: 11 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>
                      แบ่งจ่าย {n} งวด{Number(pkgPrice) > 0 ? ` (งวดละ ~${Math.ceil(Number(pkgPrice) / n).toLocaleString()})` : ""}
                    </option>
                  ))}
                </select>
                {pkgInstallments > 1 && (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={pkgFirstPay}
                        onChange={(e) => setPkgFirstPay(e.target.value)}
                        placeholder="รับงวดแรกวันนี้ (บาท) — ว่าง = ยังไม่รับ"
                        className={`min-w-0 flex-1 ${inputCls}`}
                      />
                      <select
                        value={pkgMethod}
                        onChange={(e) => setPkgMethod(e.target.value as "transfer" | "cash")}
                        className={`!w-24 shrink-0 ${inputCls}`}
                        aria-label="รับเงินทาง"
                      >
                        <option value="transfer">โอน</option>
                        <option value="cash">เงินสด</option>
                      </select>
                    </div>
                    <p className="flex items-center gap-1 text-[10px] font-bold text-wait">
                      <Icon name="alert" size={12} />
                      คอร์สจะยังใช้ไม่ได้จนกว่าจะจ่ายครบทุกงวด · รับงวดถัดไปได้ที่ปุ่ม &quot;รับงวด&quot; ในรายการคอร์ส
                    </p>
                  </>
                )}
              </div>
            )}

            {pkgPreview && (
              <PreviewSendModal
                messages={pkgPreview}
                sending={pkgBusy}
                onConfirm={sellPackage}
                onCancel={() => setPkgPreview(null)}
              />
            )}

            <div className="mt-2 space-y-2">
              <CheckRow
                checked={pkgLegacy}
                onChange={setPkgLegacy}
                icon="clock"
                title="ยกมาจากระบบเก่า"
                sub={
                  <>
                    ลูกค้าได้ครั้งครบตามปกติ แต่จะ<b>ไม่นับเป็นรายรับ</b>ของร้านเดือนนี้
                  </>
                }
              />
              <CheckRow
                checked={pkgNotify}
                onChange={setPkgNotify}
                icon="message"
                title="แจ้งลูกค้าทาง LINE ด้วย"
                sub="ส่งการ์ดบอกจำนวนครั้งคงเหลือ (เสียโควตา 1 ข้อความ) · ไม่ติ๊ก = บันทึกเงียบๆ"
              />
            </div>

            <button
              type="button"
              disabled={pkgBusy || !pkgName.trim() || pkgTotal() <= 0}
              onClick={pkgNotify ? previewPackage : sellPackage}
              className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-catcha-sm bg-sage px-3 py-2.5 text-sm font-extrabold text-card disabled:opacity-40"
            >
              <Icon name={pkgNotify ? "eye" : "plus"} size={16} />
              {pkgNotify ? "ดูการ์ด" : pkgLegacy ? "ยกคอร์สมา" : "ขายคอร์ส"}
            </button>

            <p className="mt-1.5 text-[10px] text-brown-faint">
              เวลาลูกค้ามาใช้ กดหักที่หน้าคิดเงิน · ลูกค้าดูครั้งคงเหลือเองได้ในแอป
            </p>
            </CollapsibleCard>
          </>,
          toolsSlot
        )}

      {editOpen && (
        <EditCustomerSheet customer={customer} onClose={() => setEditOpen(false)} onSaved={onSaved} />
      )}

      {!customer.lineUserId && (
        <AdoptLineControl customer={customer} onMerged={onSaved} />
      )}

      {mergeOpen && (
        <MergeCustomerControl
          customer={customer}
          onMerged={onSaved}
          startOpen
          onClose={() => setMergeOpen(false)}
        />
      )}
    </section>
  );
}

/**
 * ลูกค้าคนนี้ยังไม่ผูก LINE ทั้งที่สมัครแล้ว — เพราะ LINE ไปติดอยู่บนอีก record
 * (ลูกค้าสมัครเอง/ระบบสร้างให้ตอนเปิดแอปครั้งแรก คนละตัวกับที่ร้านสร้างไว้)
 * ปุ่มนี้ให้ร้านดึง record ที่ถือ LINE เข้ามารวมได้เอง — ลูกค้าไม่ต้องกดอะไรเลย
 */
function AdoptLineControl({
  customer,
  onMerged,
}: {
  customer: CustomerRecord;
  onMerged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(customer.name);
  const [results, setResults] = useState<CustomerRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      try {
        const d = await fetch(`/api/customers?q=${encodeURIComponent(query)}`).then((r) =>
          r.json()
        );
        // เอาเฉพาะบัญชีที่ "มี LINE แล้ว" — บัญชีที่ยังไม่ผูกดึงมาก็ไม่ช่วยอะไร
        setResults(
          (d.customers || [])
            .filter((c: CustomerRecord) => c.id !== customer.id && c.lineUserId)
            .slice(0, 8)
        );
      } catch {
        /* ค้นไม่ได้ = ไม่โชว์ */
      } finally {
        setSearched(true);
      }
    },
    [customer.id]
  );

  useEffect(() => {
    if (open) void search(q);
    // เปิดครั้งแรกให้ค้นด้วยชื่อลูกค้าเลย — ส่วนใหญ่บัญชีซ้ำใช้ชื่อใกล้กัน
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const adopt = async (source: CustomerRecord) => {
    if (
      !confirm(
        `ดึง LINE ของ "${source.lineDisplayName || source.name}" มาผูกกับ "${customer.name}"?\n\n` +
          `แต้ม · คูปอง · เครดิต · บิล · แมว จะย้ายมาที่ "${customer.name}" ทั้งหมด\n` +
          `แล้วบัญชีซ้ำ "${source.name}" จะถูกลบ (กู้ได้จากถังขยะ)\n\n` +
          `ลูกค้าไม่ต้องทำอะไรเลย`
      )
    )
      return;
    setBusy(true);
    try {
      // รวมบัญชีที่ถือ LINE (source) เข้าบัญชีนี้ (target) — ทิศทางกลับกับปุ่มรวมด้านล่าง
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: source.id,
          action: "merge_customer",
          targetId: customer.id,
        }),
      });
      if (res.ok) {
        toast("ผูก LINE ให้แล้ว ✓ ลูกค้าไม่ต้องทำอะไร", "success");
        onMerged();
      } else {
        toast("ผูกไม่สำเร็จ", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex min-h-[48px] w-full items-center gap-3 rounded-catcha-sm border border-ok/40 bg-ok/10 px-3 py-2.5 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-ok">
          <Icon name="link" size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-extrabold text-ok">ผูก LINE ให้เอง</span>
          <span className="block text-[10px] text-brown-soft">ลูกค้าไม่ต้องกดอะไร</span>
        </span>
        <Icon name="chevron" size={16} className="text-ok" />
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-catcha-sm border border-ok/40 bg-card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Icon name="link" size={16} className="text-ok" />
        <p className="min-w-0 flex-1 truncate text-xs font-extrabold text-catcha-chocolate">
          ผูก LINE ให้ “{customer.name}”
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="ปิด"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-brown"
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      {/* ทางลัด: นัดที่จองผ่าน LINE เก็บ LINE ID ไว้กับตัวนัดอยู่แล้ว — ดึงมาใช้ได้เลย
          ไม่ต้องหา record ซ้ำเอง (ต่อให้ตัวซ้ำโดนลบไปแล้วก็ยังดึงได้) */}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/customers", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: customer.id, action: "adopt_line_from_bookings" }),
            });
            const d = await res.json().catch(() => ({}));
            if (res.ok) {
              toast("ผูก LINE จากนัดให้แล้ว ✓ ลูกค้าไม่ต้องทำอะไร", "success");
              onMerged();
            } else {
              toast(d.error || "ดึงจากนัดไม่ได้ — ลองเลือกจากรายชื่อด้านล่าง", "error");
            }
          } finally {
            setBusy(false);
          }
        }}
        className="mb-2 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-catcha-sm bg-ok px-3 py-2.5 text-xs font-extrabold text-white disabled:opacity-40"
      >
        {!busy && <Icon name="sparkle" size={16} />}
        {busy ? "กำลังผูก…" : "ดึง LINE จากนัดของลูกค้าอัตโนมัติ (แนะนำ)"}
      </button>
      <p className="mb-2 text-[10px] text-brown-faint">
        หรือเลือกบัญชีที่ลูกค้าใช้อยู่จริง (บัญชีที่มี LINE แล้ว) — ระบบจะย้ายแต้ม/คูปอง/บิล
        มารวมที่นี่แล้วลบตัวซ้ำให้
      </p>
      <SearchField
        value={q}
        onChange={(v) => {
          setQ(v);
          void search(v);
        }}
        placeholder="พิมพ์ชื่อลูกค้า / ชื่อ LINE"
      />
      <ul className="mt-2 divide-y divide-catcha-line rounded-catcha-sm border border-catcha-line bg-card">
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => adopt(c)}
              className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-40 active:bg-paper"
            >
              <Avatar name={c.name} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-catcha-chocolate">{c.name}</span>
                  <span className="shrink-0 rounded-full bg-ok/15 px-1.5 py-px text-[9px] font-bold text-ok">LINE</span>
                </span>
                {c.lineDisplayName && (
                  <span className="block truncate text-[11px] text-brown-soft">LINE: {c.lineDisplayName}</span>
                )}
              </span>
              <Icon name="chevron" size={16} className="text-brown-faint" />
            </button>
          </li>
        ))}
        {searched && results.length === 0 && (
          <li className="px-3 py-3 text-center text-[11px] text-brown-faint">
            ไม่เจอบัญชีที่ผูก LINE ไว้ — ลองพิมพ์ชื่อ LINE ของลูกค้าดู
          </li>
        )}
      </ul>
    </div>
  );
}

/** รวมลูกค้าซ้ำ 2 record → 1 (คนเดียวโดนแยกเพราะ LINE ให้ ID คนละตัวคอม/มือถือ) */
function MergeCustomerControl({
  customer,
  onMerged,
  startOpen = false,
  onClose,
}: {
  customer: CustomerRecord;
  onMerged: () => void;
  /** เปิดแผงค้นหาทันที (เรียกจากเมนู ⋯ ของการ์ดลูกค้า) */
  startOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(startOpen);
  const close = () => {
    setOpen(false);
    onClose?.();
  };
  const [q, setQ] = useState("");
  const [results, setResults] = useState<
    { id: string; name: string; lineDisplayName?: string; points?: number }[]
  >([]);
  const [busy, setBusy] = useState(false);

  const search = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    try {
      const d = await fetch(`/api/customers?q=${encodeURIComponent(query)}`).then((r) => r.json());
      setResults((d.customers || []).filter((c: { id: string }) => c.id !== customer.id).slice(0, 8));
    } catch {
      /* ค้นไม่ได้ = ไม่โชว์ */
    }
  };

  const merge = async (target: { id: string; name: string }) => {
    if (
      !confirm(
        `รวม "${customer.name}" เข้ากับ "${target.name}"?\n\n` +
          `แต้ม · คูปอง · เครดิต · บิล · แมว · LINE ID จะย้ายไปที่ "${target.name}" ` +
          `แล้วลบ "${customer.name}" ทิ้ง\n\n⚠️ ทำแล้วกู้คืนไม่ได้`
      )
    )
      return;
    setBusy(true);
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: customer.id, action: "merge_customer", targetId: target.id }),
      });
      if (res.ok) {
        toast("รวมบัญชีลูกค้าแล้ว ✓", "success");
        onMerged();
      } else {
        toast("รวมไม่สำเร็จ", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-catcha-sm border border-latte/40 bg-latte/10 py-2.5 text-xs font-bold text-latte-deep"
      >
        <Icon name="users" size={16} />
        รวมกับลูกค้าอื่น (กรณีบัญชีซ้ำ)
      </button>
    );
  }
  return (
    <div className="mt-3 rounded-catcha-sm border border-latte/40 bg-card p-3">
      <div className="mb-1 flex items-center gap-2">
        <Icon name="users" size={16} className="text-latte-deep" />
        <p className="min-w-0 flex-1 text-xs font-extrabold text-catcha-chocolate">
          รวม “{customer.name}” เข้ากับลูกค้าอีกคน
        </p>
        <button
          type="button"
          onClick={close}
          aria-label="ยกเลิก"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-brown"
        >
          <Icon name="x" size={16} />
        </button>
      </div>
      <p className="mb-2 text-[10px] text-brown-faint">
        ค้นหา “ลูกค้าปลายทาง” (ตัวที่จะเก็บไว้) — ข้อมูลของคนนี้จะย้ายไปที่นั่นทั้งหมดแล้วลบคนนี้ทิ้ง
      </p>
      <SearchField
        value={q}
        onChange={(v) => {
          setQ(v);
          search(v);
        }}
        placeholder="พิมพ์ชื่อลูกค้าปลายทาง"
        autoFocus
      />
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-catcha-line rounded-catcha-sm border border-catcha-line bg-card">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => merge(c)}
                className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-40 active:bg-paper"
              >
                <Avatar name={c.name} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-catcha-chocolate">{c.name}</span>
                  <span className="block truncate text-[11px] text-brown-soft">
                    {[c.lineDisplayName ? `LINE: ${c.lineDisplayName}` : "", typeof c.points === "number" ? `${c.points} แต้ม` : ""]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </span>
                <Icon name="chevron" size={16} className="text-brown-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type AddCatGender = "male" | "female" | "";
type AddCatFurLength = "" | "short" | "long";

/**
 * เลือกสายพันธุ์แบบ dropdown (เหมือนหน้าสมัครสมาชิกลูกค้า) — พิมพ์เองไม่ได้แล้ว
 * ยกเว้นเลือก "อื่นๆ" ถึงพิมพ์ชื่อพันธุ์เองได้ ป้องกันพันธุ์สะกดไม่ตรงกัน ใช้จับคู่ราคา
 * อาบน้ำอัตโนมัติที่หน้าคิดเงินไม่ได้ (ดู groomBreedCategoryFor)
 */
function CatBreedField({
  breed,
  onSave,
}: {
  breed?: string;
  onSave: (breed: string) => void;
}) {
  const isCustom = !!breed && !BREED_OPTIONS.includes(breed);
  const [otherMode, setOtherMode] = useState(isCustom);
  const [otherText, setOtherText] = useState(isCustom ? breed || "" : "");

  useEffect(() => {
    const nowCustom = !!breed && !BREED_OPTIONS.includes(breed);
    setOtherMode(nowCustom);
    setOtherText(nowCustom ? breed || "" : "");
  }, [breed]);

  return (
    <div>
      <select
        value={otherMode ? OTHER_BREED : breed || ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER_BREED) {
            setOtherMode(true);
            return;
          }
          setOtherMode(false);
          onSave(v);
        }}
        className={inputCls}
      >
        <option value="">เลือกสายพันธุ์…</option>
        {BREED_OPTIONS.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
        <option value={OTHER_BREED}>{OTHER_BREED}</option>
      </select>
      {otherMode && (
        <input
          value={otherText}
          onChange={(e) => setOtherText(e.target.value)}
          onBlur={() => {
            if (otherText.trim()) onSave(otherText.trim());
          }}
          placeholder="ระบุสายพันธุ์"
          className={`mt-1 ${inputCls}`}
        />
      )}
    </div>
  );
}

function AddCatForm({ customerId, onAdded }: { customerId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [gender, setGender] = useState<AddCatGender>("");
  const [breed, setBreed] = useState("");
  const [breedOther, setBreedOther] = useState("");
  const [furLength, setFurLength] = useState<AddCatFurLength>("");
  const [neutered, setNeutered] = useState<"" | "yes" | "no">("");
  const [color, setColor] = useState("");
  const [ageValue, setAgeValue] = useState("");
  const [ageUnit, setAgeUnit] = useState<"year" | "month">("year");
  const [birthday, setBirthday] = useState("");
  const [medical, setMedical] = useState("");
  const [seizureHistory, setSeizureHistory] = useState("");
  const [allergy, setAllergy] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setOpen(false);
    setName("");
    setGender("");
    setBreed("");
    setBreedOther("");
    setFurLength("");
    setNeutered("");
    setColor("");
    setAgeValue("");
    setAgeUnit("year");
    setBirthday("");
    setMedical("");
    setSeizureHistory("");
    setAllergy("");
    setNote("");
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: customerId,
        action: "add_cat",
        name: name.trim(),
        gender: gender || undefined,
        breed: (breed === OTHER_BREED ? breedOther.trim() : breed) || undefined,
        furLength: furLength || undefined,
        neutered: neutered ? neutered === "yes" : undefined,
        color: color.trim() || undefined,
        ageValue: ageValue ? Number(ageValue) : undefined,
        ageUnit,
        birthday: birthday || undefined,
        medical: medical.trim() || undefined,
        seizureHistory: seizureHistory.trim() || undefined,
        allergy: allergy.trim() || undefined,
        staffNote: note.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && data.ok) {
      close();
      onAdded();
    } else {
      setError(data.error || "บันทึกไม่สำเร็จ — ลองใหม่อีกครั้ง");
    }
  };

  return (
    <>
      {/* ปุ่มเพิ่มน้องให้เห็นชัด — ต่อท้ายรายการน้องของบ้านนี้ */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex min-h-[56px] w-full items-center gap-3 rounded-catcha border-2 border-honey-deep bg-honey/45 px-4 text-left text-catcha-chocolate shadow-catcha-sm transition active:scale-[.98]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-catcha-chocolate text-card">
          <Icon name="plus" size={20} strokeWidth={2.4} />
        </span>
        <span className="flex-1 text-sm font-extrabold">เพิ่มน้องแมวอีกตัว</span>
        <Icon name="paw" size={22} className="text-catcha-chocolate/60" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-catcha bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-catcha sm:rounded-catcha">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-honey/25 text-catcha-chocolate">
                <Icon name="paw" size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">New cat</p>
                <h2 className="text-base font-extrabold text-catcha-chocolate">เพิ่มน้องแมว</h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="ปิด"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-brown"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <label className="block text-xs font-bold text-brown-soft">
                ชื่อน้องแมว *
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น น้องจู๊ด"
                  required
                  autoFocus
                  className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm font-bold"
                />
              </label>

              <Segmented
                value={gender}
                onChange={setGender}
                options={[
                  { id: "male", label: "ตัวผู้" },
                  { id: "female", label: "ตัวเมีย" },
                ]}
              />

              <label className="block text-xs font-bold text-brown-soft">
                พันธุ์
                <select
                  value={breed}
                  onChange={(e) => setBreed(e.target.value)}
                  className="mt-1 w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm"
                >
                  <option value="">เลือกสายพันธุ์…</option>
                  {BREED_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                  <option value={OTHER_BREED}>{OTHER_BREED}</option>
                </select>
              </label>
              {breed === OTHER_BREED && (
                <input
                  value={breedOther}
                  onChange={(e) => setBreedOther(e.target.value)}
                  placeholder="ระบุสายพันธุ์"
                  className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
                />
              )}

              <Segmented
                value={furLength}
                onChange={setFurLength}
                options={[
                  { id: "short", label: "ขนสั้น" },
                  { id: "long", label: "ขนยาว" },
                ]}
              />

              <Segmented
                value={neutered}
                onChange={setNeutered}
                options={[
                  { id: "yes", label: "ทำหมันแล้ว" },
                  { id: "no", label: "ยังไม่ทำ" },
                ]}
              />

              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="สี/ลักษณะเด่น (ไม่บังคับ)"
                className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
              />

              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={ageValue}
                  onChange={(e) => setAgeValue(e.target.value)}
                  placeholder="อายุ"
                  className="min-w-0 flex-1 rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
                />
                <select
                  value={ageUnit}
                  onChange={(e) => setAgeUnit(e.target.value as "year" | "month")}
                  className="w-24 shrink-0 rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
                >
                  <option value="year">ปี</option>
                  <option value="month">เดือน</option>
                </select>
              </div>

              <div className="text-[10px] font-bold text-brown-soft">
                วันเกิดน้อง <span className="font-normal text-brown-faint">(ถ้าทราบ)</span>
                <div className="mt-1">
                  <BirthdayPicker value={birthday} onChange={setBirthday} yearsBack={25} allowUnknown />
                </div>
              </div>

              <StaffNoteTagPicker
                label="โรคประจำตัว / เรื่องที่ช่างต้องรู้"
                medicalValue={medical}
                noteValue={note}
                onChange={(m, n) => {
                  setMedical(m);
                  setNote(n);
                }}
              />
              <input
                value={seizureHistory}
                onChange={(e) => setSeizureHistory(e.target.value)}
                placeholder="ประวัติการชัก/ช็อค (ไม่บังคับ)"
                className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
              />
              <input
                value={allergy}
                onChange={(e) => setAllergy(e.target.value)}
                placeholder="ประวัติการแพ้ (ไม่บังคับ)"
                className="w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2 text-sm"
              />

              {error && <p className="text-xs font-bold text-wait">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={close}
                  className="min-h-[44px] flex-1 rounded-catcha-sm bg-paper py-3 text-sm font-bold text-brown-soft"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="flex min-h-[44px] flex-[2] items-center justify-center gap-1.5 rounded-catcha-sm bg-catcha-chocolate py-3 text-sm font-extrabold text-card shadow-catcha-sm disabled:opacity-50"
                >
                  {!saving && <Icon name="check" size={16} strokeWidth={2.4} />}
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function CustomersPage() {
  const { config } = useConfig();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [list, setList] = useState<CustomerListItem[]>([]);
  const [selected, setSelected] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);
  /** ช่องท้ายหน้าที่ฟอร์มเพิ่มแต้ม/ขายคอร์สไปวาง */
  const [toolsSlot, setToolsSlot] = useState<HTMLDivElement | null>(null);
  const [tierFilter, setTierFilter] = useState<CustomerTier | "all">("all");
  const [lineFilter, setLineFilter] = useState<"all" | "linked" | "unlinked">("all");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const resetFilters = () => {
    setQ("");
    setTierFilter("all");
    setLineFilter("all");
    setSortKey("recent");
    setSortDir("desc");
  };

  const visibleList = list
    .filter((c) => tierFilter === "all" || (c.tier || "new") === tierFilter)
    .filter((c) => {
      if (lineFilter === "all") return true;
      const linked = Boolean(c.lineUserId);
      return lineFilter === "linked" ? linked : !linked;
    })
    .slice()
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, "th");
      else if (sortKey === "tier")
        cmp = (a.tier || "new").localeCompare(b.tier || "new");
      else if (sortKey === "points") cmp = (a.points || 0) - (b.points || 0);
      else if (sortKey === "credit") cmp = (a.memberCredit || 0) - (b.memberCredit || 0);
      else if (sortKey === "upcoming")
        cmp = (a.upcomingAppointments || 0) - (b.upcomingAppointments || 0);
      else if (sortKey === "birthday")
        cmp = (a.birthday || "").localeCompare(b.birthday || "");
      else if (sortKey === "recent")
        cmp = (a.createdAt || "").localeCompare(b.createdAt || "");
      else if (sortKey === "updated")
        cmp = (a.updatedAt || "").localeCompare(b.updatedAt || "");
      else if (sortKey === "cats") cmp = a.cats.length - b.cats.length;
      else if (sortKey === "catName")
        cmp = (a.cats[0]?.name || "￿").localeCompare(b.cats[0]?.name || "￿", "th");
      else if (sortKey === "phone") cmp = (a.phone || "￿").localeCompare(b.phone || "￿");
      else if (sortKey === "line") cmp = Number(Boolean(a.lineUserId)) - Number(Boolean(b.lineUserId));
      else if (sortKey === "birthdaySoon") {
        const soon = (c: CustomerListItem) =>
          Math.min(
            daysToNextBirthday(c.birthday),
            ...c.cats.map((x) => daysToNextBirthday(x.birthday))
          );
        cmp = soon(a) - soon(b);
      }
      if (cmp === 0) cmp = a.name.localeCompare(b.name, "th");
      return sortDir === "asc" ? cmp : -cmp;
    });

  const search = useCallback(async (query: string) => {
    setLoading(true);
    const params = query ? `?q=${encodeURIComponent(query)}` : "";
    const res = await fetch(`/api/customers${params}`);
    const data = await res.json();
    setList(data.customers || []);
    setLoading(false);
  }, []);

  const open = useCallback(async (id: string) => {
    // ลูกค้าถูกลบไปแล้ว / ลิงก์เก่า → เมื่อก่อน setSelected({error}) แล้วจอขาวทั้งหน้า
    try {
      const res = await fetch(`/api/customers?id=${id}`);
      const data = await res.json();
      if (!res.ok || !data?.customer) {
        toast("ไม่พบข้อมูลลูกค้ารายนี้ (อาจถูกลบไปแล้ว)", "error");
        return;
      }
      setSelected(data);
    } catch {
      toast("โหลดข้อมูลลูกค้าไม่สำเร็จ ลองใหม่อีกครั้งนะคะ", "error");
    }
  }, []);

  const deleteCustomerRow = async (c: CustomerListItem) => {
    if (!confirm(`ลบลูกค้า ${c.name}?\n(ย้ายลงถังขยะ กู้คืนได้ที่เมนู 🗑️ ถังขยะ)`)) return;
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, action: "delete_customer" }),
    });
    if (res.ok) {
      toast("ย้ายลูกค้าลงถังขยะแล้ว 🗑️", "success");
      search(q);
    } else {
      toast("ลบไม่สำเร็จ", "error");
    }
  };

  // ค้นหาสด — พิมพ์แล้วกรองเลย (หน่วง 300ms) ไม่ต้องกดปุ่ม
  useEffect(() => {
    const t = setTimeout(() => search(q), 300);
    return () => clearTimeout(t);
  }, [q, search]);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) open(id);
  }, [searchParams, open]);

  // เปิดลูกค้าคนใหม่ (หรือกดกลับไปหน้ารายชื่อ) → เริ่มที่บนสุดเสมอ ไม่ค้างตำแหน่งเลื่อนเดิม
  // (โหลดข้อมูลคนเดิมซ้ำหลังบันทึกไม่นับ — id ไม่เปลี่ยน จอเลยไม่เด้ง)
  const selectedId = selected?.customer.id ?? null;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedId]);

  const saveCat = async (
    catId: string,
    patch: {
      name?: string;
      staffNote?: string;
      photoDataUrl?: string;
      gender?: "male" | "female";
      breed?: string;
      furLength?: "short" | "long";
      neutered?: boolean;
      color?: string;
      ageValue?: number;
      ageUnit?: "year" | "month";
      weightKg?: number | null;
      birthday?: string;
      medical?: string;
      seizureHistory?: string;
      allergy?: string;
    }
  ) => {
    if (!selected) return;
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.customer.id,
        action: "update_cat",
        catId,
        patch,
      }),
    });
    const oldName = selected.customer.cats.find((c) => c.id === catId)?.name;
    if (res.ok) {
      toast(
        patch.name !== undefined && oldName && patch.name.trim() !== oldName
          ? "✅ เปลี่ยนชื่อแล้ว · นัดและบิลเปลี่ยนตามให้ด้วย"
          : "✅ บันทึกข้อมูลแมวแล้ว",
        "success"
      );
    } else {
      const j = await res.json().catch(() => ({}));
      toast(j.error || "บันทึกไม่สำเร็จ", "error");
    }
    open(selected.customer.id);
  };

  const deleteCatProfile = async (cat: CatRecord) => {
    if (!selected) return;
    if (!confirm(`ลบโปรไฟล์ ${cat.name}?`)) return;
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.customer.id,
        action: "delete_cat",
        catId: cat.id,
      }),
    });
    if (res.ok) open(selected.customer.id);
    else alert("ลบไม่สำเร็จ");
  };

  const saveCatNote = async (catId: string, staffNote: string, photoDataUrl?: string) => {
    await saveCat(catId, { staffNote, ...(photoDataUrl ? { photoDataUrl } : {}) });
  };

  const saveCatPrivateNote = async (catId: string, note: string) => {
    if (!selected) return;
    const res = await fetch("/api/customers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selected.customer.id,
        action: "update_cat_private_note",
        catId,
        note,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.needSql) {
      alert(
        "บันทึกโน้ตลับยังไม่ได้ ต้องรัน SQL เพิ่มคอลัมน์ใน Supabase ก่อน (ดู webapp/OVERNIGHT_SQL.md)"
      );
      return;
    }
    // ยืนยันให้เห็นชัด — ก่อนหน้านี้เงียบทั้งตอนสำเร็จและตอนพลาด แยกไม่ออกว่าเซฟติดไหม
    if (res.ok) toast("บันทึกโน้ตลับร้านแล้ว 🔒", "success");
    else toast("บันทึกโน้ตลับไม่สำเร็จ", "error");
  };


  const onPhoto = async (cat: CatRecord, file: File) => {
    try {
      const dataUrl = await toJpegDataUrl(file);
      await saveCatNote(cat.id, cat.staffNote || "", dataUrl);
    } catch (e) {
      alert(e instanceof Error ? e.message : "อัปโหลดรูปไม่สำเร็จ");
    }
  };

  if (selected) {
    const c = selected.customer;
    return (
      <div>
        <button
          type="button"
          onClick={() => setSelected(null)}
          className="mb-3 flex min-h-[40px] items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-xs font-bold text-brown shadow-catcha-sm"
        >
          <Icon name="back" size={16} />
          ลูกค้าทั้งหมด
        </button>
        <CustomerSummaryCard
          customer={c}
          points={selected.points}
          visits={selected.visits}
          lastVisitDate={selected.lastVisitDate}
          daysSinceVisit={selected.daysSinceVisit}
          inactive={selected.inactive}
          canFollowUp={selected.canFollowUp}
          onSaved={() => open(c.id)}
          toolsSlot={toolsSlot}
        />

        <CustomerLinkSection
          customerId={c.id}
          customerName={c.name}
          hasLine={Boolean(c.lineUserId)}
        />

        <section className="mb-4">
          <SectionLabel>Cats · น้องแมว ({c.cats.length})</SectionLabel>

          {c.cats.length === 0 && (
            <div className="rounded-catcha bg-card shadow-catcha-sm">
              <EmptyState icon="paw" title="ยังไม่มีน้องแมว" sub="กด “เพิ่มน้องแมวอีกตัว” ด้านล่างเพื่อเพิ่ม" />
            </div>
          )}
          <div className="space-y-3">
          {c.cats.map((cat) => (
            <div key={cat.id} className="rounded-catcha bg-card shadow-catcha-sm">
              <div className="flex items-center gap-3 p-4 pb-3">
                {/* แตะรูปเพื่อดูเต็มจอ · ปุ่มกล้องเพื่อเปลี่ยนรูป (ลูกค้าเห็นในแอปด้วย) */}
                <CatPhoto src={cat.photoDataUrl} name={cat.name} size={72} onPick={(f) => onPhoto(cat, f)} />
                <label className="block min-w-0 flex-1 text-[11px] font-bold text-brown-soft">
                  <span className="mb-1 block">ชื่อน้องแมว</span>
                  <input
                    defaultValue={cat.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== cat.name) saveCat(cat.id, { name: v });
                    }}
                    className={`font-bold text-brown ${inputCls}`}
                  />
                </label>
                <MoreMenu
                  items={[
                    { label: "ลบโปรไฟล์ตัวนี้", icon: "trash", danger: true, onClick: () => deleteCatProfile(cat) },
                  ]}
                />
              </div>
              <p className="-mt-1 px-4 pb-2 text-[10px] text-brown-faint">แตะรูปเพื่อดูเต็มจอ · ปุ่มกล้องเพื่อเปลี่ยนรูป (ลูกค้าเห็นในแอปด้วย)</p>
              {(() => {
                // อาบน้ำครั้งล่าสุดของตัวนี้ — ตอนออกบิลระบบจะเลือกแบบเดิมให้เอง
                const last = lastGroomForPet(
                  billsAsPast(selected.history.serviceBills),
                  cat.name,
                  c.cats.length === 1
                );
                return last ? (
                  <p className="mx-4 mb-2 flex items-start gap-1.5 rounded-catcha-sm bg-honey/15 px-3 py-2 text-[11px] text-brown">
                    <Icon name="bath" size={14} />
                    <span>
                      อาบครั้งก่อน {last.when ? `(${last.when.slice(0, 10)})` : ""}: {last.programName} · {last.breed}
                      {last.sizeLabel ? ` · ${last.sizeLabel}` : ""} ·{" "}
                      <b>฿{last.unitAmount.toLocaleString()}</b>
                    </span>
                  </p>
                ) : null;
              })()}

              <div className="space-y-3 border-t border-catcha-line p-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Segmented
                    value={(cat.gender ?? "") as "" | "male" | "female"}
                    onChange={(v) => {
                      if (v) saveCat(cat.id, { gender: v });
                    }}
                    options={[
                      { id: "male", label: "ตัวผู้" },
                      { id: "female", label: "ตัวเมีย" },
                    ]}
                  />
                  <Segmented
                    value={(cat.furLength ?? "") as "" | "short" | "long"}
                    onChange={(v) => {
                      if (v) saveCat(cat.id, { furLength: v });
                    }}
                    options={[
                      { id: "short", label: "ขนสั้น" },
                      { id: "long", label: "ขนยาว" },
                    ]}
                  />
                  <Segmented
                    value={cat.neutered === true ? "yes" : cat.neutered === false ? "no" : ""}
                    onChange={(v) => {
                      if (v) saveCat(cat.id, { neutered: v === "yes" });
                    }}
                    options={[
                      { id: "yes", label: "ทำหมันแล้ว" },
                      { id: "no", label: "ยังไม่ทำ" },
                    ]}
                  />
                </div>
                <label className="block text-[11px] font-bold text-brown-soft">
                  <span className="mb-1 block">พันธุ์</span>
                  <CatBreedField
                    breed={cat.breed}
                    onSave={(breed) => saveCat(cat.id, { breed })}
                  />
                </label>
                <label className="block text-[11px] font-bold text-brown-soft">
                  <span className="mb-1 block">สี/ลักษณะเด่น</span>
                  <input
                    defaultValue={cat.color}
                    placeholder="เช่น สีขาวสลับดำ มีจุดที่หู"
                    className={inputCls}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (cat.color || "")) saveCat(cat.id, { color: v });
                    }}
                  />
                </label>
                <div className="flex gap-2">
                  <label className="block min-w-0 flex-1 text-[11px] font-bold text-brown-soft">
                    <span className="mb-1 block">อายุ</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      defaultValue={cat.ageValue}
                      className={inputCls}
                      onBlur={(e) => {
                        const v = e.target.value ? Number(e.target.value) : undefined;
                        if (v !== undefined && v !== cat.ageValue) {
                          saveCat(cat.id, { ageValue: v, ageUnit: cat.ageUnit || "year" });
                        }
                      }}
                    />
                  </label>
                  <label className="block w-28 shrink-0 text-[11px] font-bold text-brown-soft">
                    <span className="mb-1 block">หน่วย</span>
                    <select
                      defaultValue={cat.ageUnit || "year"}
                      className={inputCls}
                      onChange={(e) =>
                        saveCat(cat.id, {
                          ageUnit: e.target.value as "year" | "month",
                          ageValue: cat.ageValue ?? 0,
                        })
                      }
                    >
                      <option value="year">ปี</option>
                      <option value="month">เดือน</option>
                    </select>
                  </label>
                </div>
                <label className="block text-[11px] font-bold text-brown-soft">
                  <span className="mb-1 block">น้ำหนัก (กก.)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    defaultValue={cat.weightKg}
                    placeholder="เช่น 4.5"
                    className={inputCls}
                    onBlur={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      if (v !== (cat.weightKg ?? null)) saveCat(cat.id, { weightKg: v });
                    }}
                  />
                </label>
                <div className="text-[11px] font-bold text-brown-soft">
                  วันเกิดน้อง <span className="font-normal text-brown-faint">(ถ้าทราบ)</span>
                  <div className="mt-1">
                    <BirthdayPicker
                      value={cat.birthday || ""}
                      onChange={(iso, info) => {
                        if (iso && iso !== cat.birthday) saveCat(cat.id, { birthday: iso });
                        // ติ๊ก "ไม่ทราบวันเกิด" → ล้างวันเกิดเดิมออก
                        else if (!iso && info?.unknown && cat.birthday) saveCat(cat.id, { birthday: "" });
                      }}
                      yearsBack={25}
                      allowUnknown
                    />
                  </div>
                </div>
                <StaffNoteTagPicker
                  label="โรคประจำตัว / เรื่องที่ช่างต้องรู้"
                  medicalValue={cat.medical || ""}
                  noteValue={cat.staffNote || ""}
                  onChange={(medical, staffNote) => saveCat(cat.id, { medical, staffNote })}
                />
                <label className="block text-[11px] font-bold text-brown-soft">
                  <span className="mb-1 block">ประวัติการชัก/ช็อค</span>
                  <input
                    defaultValue={cat.seizureHistory}
                    placeholder="เช่น ไม่เคย · หรือ เคยชักตอนตกใจ"
                    className={inputCls}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (cat.seizureHistory || "")) saveCat(cat.id, { seizureHistory: v });
                    }}
                  />
                </label>
                <label className="block text-[11px] font-bold text-brown-soft">
                  <span className="mb-1 block">ประวัติการแพ้</span>
                  <input
                    defaultValue={cat.allergy}
                    placeholder="เช่น ไม่มี · หรือ แพ้ไก่ แพ้แชมพูบางยี่ห้อ"
                    className={inputCls}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (cat.allergy || "")) saveCat(cat.id, { allergy: v });
                    }}
                  />
                </label>
                <label className="block rounded-catcha-sm border border-wait/40 bg-wait/5 px-3 py-2.5 text-[11px] font-bold text-wait">
                  <span className="mb-1 flex items-center gap-1.5">
                    <Icon name="eye" size={14} />
                    โน้ตลับร้าน (ลูกค้าไม่เห็น)
                  </span>
                  <textarea
                    defaultValue={cat.staffPrivateNote}
                    placeholder="เช่น กัด ข่วน ดุมาก ระวังตอนอาบน้ำ — เฉพาะพนักงาน"
                    className="w-full rounded-catcha-sm border border-wait/30 bg-card px-3 py-2 text-sm font-normal text-brown"
                    rows={2}
                    onBlur={(e) => saveCatPrivateNote(cat.id, e.target.value)}
                  />
                </label>
                  {(() => {
                    const gi = parseGroomInfo(cat.groomHealthInfo);
                    if (!gi) {
                      return (
                        <div className="rounded-catcha-sm border border-catcha-line bg-paper/60 px-3 py-2.5">
                          <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-brown-faint">
                            <Icon name="bath" size={14} />
                            ประวัติก่อนอาบน้ำ — ลูกค้ายังไม่ได้กรอก
                          </p>
                        </div>
                      );
                    }
                    const s = groomInfoSummary(gi);
                    return (
                      <div className="rounded-catcha-sm border border-sage/40 bg-sage/10 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-ok">
                            <Icon name="bath" size={14} />
                            ประวัติก่อนอาบน้ำ (ลูกค้ากรอกไว้)
                          </p>
                          {gi.submittedAt && (
                            <p className="text-[9px] text-brown-faint">
                              {new Date(gi.submittedAt).toLocaleString("th-TH", {
                                dateStyle: "medium",
                                timeStyle: "short",
                                calendar: "gregory",
                              })}
                            </p>
                          )}
                        </div>
                        <dl className="mt-1.5 space-y-1 text-[11px] text-brown">
                          {Object.entries(s).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <dt className="w-24 shrink-0 font-bold text-brown-soft">{k}</dt>
                              <dd className="min-w-0 flex-1 break-words">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    );
                  })()}
                  {/* ข้อมูลก่อนเข้าพัก (อาหาร/ชอบ-ไม่ชอบ/การดูแล) — โชว์เมื่อลูกค้ากรอกแล้ว */}
                  {(() => {
                    const si = parseGroomInfo(cat.stayInfo);
                    if (!si) return null;
                    // ทุกข้อที่ลูกค้าเคยตอบ (รวมข้อที่ร้านปิดไปทีหลัง) — คำตอบเก่าไม่หาย
                    const s = groomInfoSummary(
                      si,
                      STAY_FORM_DEFAULTS.filter((f) => f.key in si)
                    );
                    return (
                      <div className="rounded-catcha-sm border border-sage/40 bg-sage/10 px-3 py-2.5">
                        <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-ok">
                          <Icon name="bed" size={14} />
                          ข้อมูลก่อนเข้าพัก (ลูกค้ากรอกไว้)
                        </p>
                        <dl className="mt-1.5 space-y-1 text-[11px] text-brown">
                          {Object.entries(s)
                            .filter(([, v]) => v !== "-")
                            .map(([k, v]) => (
                              <div key={k} className="flex gap-2">
                                <dt className="w-24 shrink-0 font-bold text-brown-soft">{k}</dt>
                                <dd className="min-w-0 flex-1 break-words">{v}</dd>
                              </div>
                            ))}
                        </dl>
                      </div>
                    );
                  })()}

                <CatMediaGallery customerId={c.id} cat={cat} onSaved={() => open(c.id)} />
              </div>
            </div>
          ))}
          </div>
          <AddCatForm customerId={c.id} onAdded={() => open(c.id)} />
        </section>

        <PastPricesSection bills={selected.history.serviceBills} />

        <CatServiceHistory
          cats={c.cats}
          bills={selected.history.serviceBills}
          bookings={[
            ...(selected.history.upcomingBookings || []),
            ...(selected.history.pastBookings || []),
          ]}
        />

        <BillingProfileCard customerId={c.id} customerName={c.name} />

        <RoomPlanSection
          customerId={c.id}
          hasLine={!!c.lineUserId}
          onChanged={() => open(c.id)}
        />

        <PackageHistorySection
          customerId={c.id}
          usage={selected.history.packageUsage || []}
          onChanged={() => open(c.id)}
        />

        <MemberCreditHistorySection
          customerId={c.id}
          memberCredit={c.memberCredit}
          topups={selected.history.memberTopups || []}
          usage={selected.history.memberCreditUsage || []}
          onChanged={() => open(c.id)}
        />

        <CustomerAppointmentsSection
          bookings={selected.history.upcomingBookings || []}
          catNames={c.cats.map((x) => x.name)}
          onRefresh={() => open(c.id)}
        />

        <StaysConsentSection
          bookings={[
            ...(selected.history.upcomingBookings || []),
            ...(selected.history.pastBookings || []),
          ]}
        />

        <ServiceHistorySection
          customerId={c.id}
          services={selected.history.services}
          pastBookings={selected.history.pastBookings || []}
          onChanged={() => open(c.id)}
        />

        <section className="rounded-catcha bg-card p-4 shadow-catcha-sm">
          <CardHeader icon="gift" title="ประวัติแลกแต้ม" />
          <ul className="divide-y divide-catcha-line rounded-catcha-sm border border-catcha-line text-xs text-brown-soft">
            {selected.history.points.map((p) => (
              <li key={p.id} className="flex min-h-[48px] items-center gap-2 py-1.5 pl-3 pr-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-brown">{p.labelTh}</span>
                  <span className="block text-[11px] text-brown-faint">{p.at.slice(0, 10)}</span>
                </span>
                <span className={`shrink-0 font-extrabold ${p.points > 0 ? "text-ok" : "text-wait"}`}>
                  {p.points > 0 ? "+" : ""}
                  {p.points}
                </span>
                <MoreMenu
                  items={[
                    {
                      label: "ลบรายการนี้",
                      icon: "trash",
                      danger: true,
                      onClick: async () => {
                        if (
                          !confirm(
                            `ลบรายการนี้? (${p.labelTh} · ${p.points > 0 ? "+" : ""}${p.points} แต้ม)\n` +
                              `ระบบจะปรับยอดแต้มคงเหลือย้อนกลับให้อัตโนมัติ` +
                              (p.points < 0
                                ? "\n\n⚠️ ถ้ารายการนี้เคยออกคูปองส่วนลดไปแล้ว การลบนี้ไม่ยกเลิกคูปองให้ — ไปเช็ค/ยกเลิกคูปองแยกต่างหากถ้าจำเป็น"
                                : "")
                          )
                        )
                          return;
                        const res = await fetch("/api/points", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "delete_history", entryId: p.id }),
                        });
                        if (res.ok) {
                          toast("ลบประวัติแต้มแล้ว", "success");
                          open(c.id);
                        } else {
                          toast("ลบไม่สำเร็จ", "error");
                        }
                    },
                    },
                  ]}
                />
              </li>
            ))}
            {!selected.history.points.length && <li className="px-3 py-3 text-brown-faint">ยังไม่มีประวัติแต้ม</li>}
          </ul>
        </section>

        {/* ฟอร์มที่ไม่ได้ใช้ทุกครั้ง — อยู่ท้ายหน้า พับไว้ก่อน แตะหัวการ์ดเพื่อเปิด */}
        <div className="mt-6">
          <SectionLabel>Add &amp; sell · เพิ่มแต้ม / ขายคอร์ส / เติมเครดิต</SectionLabel>
          <div ref={setToolsSlot} />
          {/* ร้านปิดเครดิต Member ในตั้งค่า › เปิด/ปิดฟีเจอร์ — เติมใหม่ไม่ได้ (ยอดเดิมยังหักจ่ายได้) */}
          {isFeatureOn(config, "memberCredit") && (
            <MemberTopupSection
              customerId={c.id}
              memberCredit={c.memberCredit}
              onDone={() => open(c.id)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Customers · ลูกค้า</p>
          <h1 className="text-xl font-extrabold text-catcha-chocolate">ลูกค้า</h1>
        </div>
        <MoreMenu
          items={[
            {
              label: showTools ? "ซ่อน QR ลงทะเบียน / Export" : "QR ลงทะเบียน / Export",
              icon: "download",
              onClick: () => setShowTools((v) => !v),
            },
          ]}
        />
      </div>
      <AddCustomerModal
        onAdded={(id) => {
          search(q);
          open(id);
        }}
      />

      <SearchField
        value={q}
        onChange={setQ}
        placeholder="ค้นหาชื่อลูกค้า / แมว / เบอร์"
        className="mb-3"
      />

      {/* ตัวกรอง — กลุ่มลูกค้า / สถานะ LINE / เรียงลำดับ */}
      <div className="mb-3 grid grid-cols-2 gap-2">
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as CustomerTier | "all")}
          aria-label="กลุ่มลูกค้า"
          className="h-10 min-w-0 rounded-full border border-catcha-line bg-card px-3 text-xs font-bold text-brown"
        >
          <option value="all">ทุกกลุ่ม</option>
          {(Object.keys(TIER_LABELS) as CustomerTier[]).map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value as "all" | "linked" | "unlinked")}
          aria-label="สถานะ LINE"
          className="h-10 min-w-0 rounded-full border border-catcha-line bg-card px-3 text-xs font-bold text-brown"
        >
          <option value="all">ทุกสถานะ LINE</option>
          <option value="linked">ผูก LINE แล้ว</option>
          <option value="unlinked">ยังไม่ผูก LINE</option>
        </select>
        <div className="col-span-2 flex gap-2">
          <select
            value={sortKey}
            onChange={(e) => {
              const opt = SORT_OPTIONS.find((o) => o.key === e.target.value);
              setSortKey(e.target.value as SortKey);
              if (opt) setSortDir(opt.defaultDir);
            }}
            aria-label="เรียงลำดับ"
            className="h-10 min-w-0 rounded-full border border-catcha-line bg-card px-3 text-xs font-bold text-brown flex-1"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                เรียง: {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-catcha-line bg-card px-3 text-xs font-bold text-brown-soft"
            title="สลับทิศทางการเรียง"
            aria-label={sortDir === "asc" ? "น้อย→มาก / ก→ฮ" : "มาก→น้อย / ฮ→ก"}
          >
            <span className="text-sm leading-none">{sortDir === "asc" ? "↑" : "↓"}</span>
            {sortDir === "asc" ? "ก→ฮ" : "ฮ→ก"}
          </button>
        </div>
      </div>

      {showTools && (
        <div className="mb-4">
          <RegistrationQrSection compact />
          <ExportSheetsButton className="mt-3" />
        </div>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-brown-soft">กำลังโหลด…</p>
      ) : (
        <>
          <div className="mb-2 flex min-h-[32px] items-center justify-between gap-2 px-1">
            <p className="text-[11px] font-bold text-brown-faint">
              {visibleList.length} ราย
              {visibleList.length !== list.length ? ` (จากทั้งหมด ${list.length})` : ""}
            </p>
            {(tierFilter !== "all" || lineFilter !== "all" || q) && (
              <button
                type="button"
                onClick={resetFilters}
                className="flex min-h-[32px] items-center gap-1 text-[11px] font-bold text-latte-deep"
              >
                <Icon name="x" size={12} />
                ล้างตัวกรอง
              </button>
            )}
          </div>

          {/* ── ตาราง (จอกว้าง) — คลิกหัวคอลัมน์เพื่อเรียง ── */}
          <div className="mb-4 hidden overflow-x-auto rounded-catcha border border-catcha-line bg-card shadow-catcha-sm md:block">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead>
                <tr className="border-b border-catcha-line bg-paper/60 text-[10px] font-extrabold uppercase tracking-wide text-brown-soft">
                  <SortableTh label="ลูกค้า" sortKey="name" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="แมว" sortKey="catName" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="LINE" sortKey="line" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="เบอร์โทร" sortKey="phone" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="วันเกิด" sortKey="birthday" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="กลุ่ม" sortKey="tier" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <SortableTh label="แต้ม" sortKey="points" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <SortableTh label="เครดิต" sortKey="credit" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <SortableTh label="นัด" sortKey="upcoming" active={sortKey} dir={sortDir} onSort={toggleSort} align="right" />
                  <SortableTh label="สมัคร" sortKey="recent" active={sortKey} dir={sortDir} onSort={toggleSort} />
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visibleList.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => open(c.id)}
                    className="cursor-pointer border-b border-catcha-line last:border-0 transition hover:bg-paper/50"
                  >
                    <td className="px-3 py-2.5 font-bold text-brown">
                      {c.name}
                      {c.isMember && <Icon name="star" size={13} className="ml-1 inline align-[-2px] text-latte-deep" />}
                      {c.lineDisplayName && c.lineDisplayName !== c.name && (
                        <span className="block text-[10px] font-normal text-brown-faint">
                          LINE: {c.lineDisplayName}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-brown-soft">
                      {c.cats.map((x) => x.name).filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      {c.lineUserId ? (
                        <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-bold text-ok">
                          ผูกแล้ว
                        </span>
                      ) : (
                        <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold text-brown-faint">
                          ยังไม่ผูก
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-brown-soft">{c.phone || "—"}</td>
                    <td className="px-3 py-2.5 text-brown-soft">{c.birthday || "—"}</td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tierBadgeClass(c.tier || "new")}`}>
                        {TIER_LABELS[c.tier || "new"]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-latte-deep">
                      {c.points || 0}
                    </td>
                    <td className="px-3 py-2.5 text-right text-brown-soft">
                      {c.memberCredit ? `${c.memberCredit.toLocaleString()}฿` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-brown-soft">
                      {c.upcomingAppointments ? (
                        <span className="inline-flex items-center gap-1">
                          <Icon name="calendar" size={12} />
                          {c.upcomingAppointments}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-brown-soft">
                      {c.createdAt ? c.createdAt.slice(0, 10) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        aria-label="ลบลูกค้า"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomerRow(c);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-brown-faint transition hover:bg-paper hover:text-wait"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {visibleList.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-6 text-center text-brown-soft">
                      ไม่พบลูกค้า
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── รายการ (มือถือ) — แตะเพื่อเปิดโปรไฟล์ · ลบลูกค้าได้จากเมนู ⋯ ในโปรไฟล์ ── */}
          <ul className="divide-y divide-catcha-line overflow-hidden rounded-catcha border border-catcha-line bg-card shadow-catcha-sm md:hidden">
            {visibleList.map((c) => {
              const photo = c.cats.find((x) => x.photoDataUrl)?.photoDataUrl;
              const catNames = c.cats.map((x) => x.name).filter(Boolean).join(", ");
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => open(c.id)}
                    className="flex min-h-[60px] w-full items-center gap-3 px-3 py-2.5 text-left transition active:bg-paper/60"
                  >
                    {photo ? (
                      <Image
                        src={photo}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <Avatar name={c.name} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-bold text-catcha-chocolate">{c.name}</span>
                        {c.lineUserId && (
                          <span className="shrink-0 rounded-full bg-ok/15 px-1.5 py-px text-[9px] font-bold text-ok">
                            LINE
                          </span>
                        )}
                        {c.isMember && <Icon name="star" size={13} className="text-latte-deep" />}
                      </span>
                      <span className="block truncate text-[11px] text-brown-soft">
                        {[c.phone, catNames || "ยังไม่มีน้องในระบบ"].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tierBadgeClass(c.tier || "new")}`}>
                        {TIER_LABELS[c.tier || "new"]}
                      </span>
                      {((c.upcomingAppointments ?? 0) > 0 || c.memberCredit > 0) && (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold">
                          {(c.upcomingAppointments ?? 0) > 0 && (
                            <span className="flex items-center gap-0.5 text-latte-deep">
                              <Icon name="calendar" size={11} />
                              {c.upcomingAppointments}
                            </span>
                          )}
                          {c.memberCredit > 0 && <span className="text-ok">{c.memberCredit}฿</span>}
                        </span>
                      )}
                    </span>
                    <Icon name="chevron" size={16} className="text-brown-faint" />
                  </button>
                </li>
              );
            })}
            {visibleList.length === 0 && (
              <li>
                <EmptyState icon="users" title="ไม่พบลูกค้า" sub="ลองเปลี่ยนคำค้นหรือล้างตัวกรอง" />
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

function SortableTh({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  align?: "right";
}) {
  const isActive = active === sortKey;
  return (
    <th className={`px-3 py-2.5 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-0.5 ${isActive ? "text-catcha-chocolate" : "text-brown-soft"}`}
      >
        {label}
        <span className="text-[9px]">{isActive ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

/**
 * ข้อมูลออกใบเสร็จ / ใบกำกับภาษีของลูกค้าคนนี้ (ในนามบริษัท ที่อยู่ เลขผู้เสียภาษี)
 * บันทึกไว้ครั้งเดียว บิลถัดไปของลูกค้าคนนี้จะออกในนามนี้อัตโนมัติ
 */
function BillingProfileCard({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [buyer, setBuyer] = useState<Buyer | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setBuyer(undefined);
    fetch(`/api/invoice-docs?profile=${encodeURIComponent(customerId)}`)
      .then((r) => (r.ok ? r.json() : { buyer: null }))
      .then((d) => setBuyer(d.buyer || null))
      .catch(() => setBuyer(null));
  }, [customerId]);

  const save = async (b: Buyer | null) => {
    const res = await fetch("/api/invoice-docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: customerId, buyer: b }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast("บันทึกไม่สำเร็จ", "error");
      return;
    }
    setBuyer(d.buyer || null);
    setEditing(false);
    toast(b ? "บันทึกข้อมูลออกบิลแล้ว" : "ลบข้อมูลออกบิลแล้ว", "success");
  };

  return (
    <section className="mb-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-brown-soft">Billing info · ข้อมูลออกบิล</p>
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={buyer === undefined}
        className="flex min-h-[64px] w-full items-center gap-3 rounded-catcha bg-card px-4 py-3 text-left shadow-catcha-sm"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-honey/35 text-catcha-chocolate">
          <Icon name="receipt" size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold text-catcha-chocolate">
            {buyer === undefined ? "กำลังโหลด…" : buyer ? buyer.name : "ออกในชื่อลูกค้า"}
          </span>
          <span className="block truncate text-[11px] text-brown-soft">
            {buyer
              ? [buyer.taxId && `เลขผู้เสียภาษี ${buyer.taxId}`, buyer.branch, buyer.address?.split("\n")[0]].filter(Boolean).join(" · ")
              : "ตั้งชื่อบริษัท ที่อยู่ เลขผู้เสียภาษี ไว้ใช้กับใบเสร็จทุกใบ"}
          </span>
        </span>
        <Icon name="chevron" size={16} className="text-brown-faint" />
      </button>
      {editing && (
        <BuyerSheet
          mode="profile"
          initial={buyer || undefined}
          fallbackName={customerName}
          onClose={() => setEditing(false)}
          onSave={(b) => save(b)}
          onUseCustomer={buyer ? () => save(null) : undefined}
        />
      )}
    </section>
  );
}
