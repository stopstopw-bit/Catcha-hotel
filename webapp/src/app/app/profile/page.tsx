"use client";

import { savedPopup } from "@/components/Toast";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiff } from "@/components/LiffProvider";
import { useConfig } from "@/components/ConfigProvider";
import { BREED_OPTIONS, OTHER_BREED } from "@/lib/cat-breeds";
import { LoadingScreen } from "@/components/LoadingScreen";
import { StaffNoteTagPicker } from "@/components/StaffNoteTagPicker";
import { BirthdayPicker } from "@/components/BirthdayPicker";
import { BTN_PRIMARY, PageHeader } from "@/components/PageHeader";
import { EmptyState, SectionLabel } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { CatPhoto } from "@/components/CatPhoto";
import { toJpegDataUrl } from "@/lib/image-convert";
import { customerFetch } from "@/lib/customer-fetch";
import { NumInput } from "@/components/NumInput";
import { ReviewSheet, reviewDate, type ReviewSection } from "@/components/ReviewSheet";
import { useL } from "@/components/LocaleProvider";
import { REFERRAL_OPTIONS_EN } from "@/lib/referral-options";

const REFERRAL_FALLBACK = [
  "Facebook",
  "Instagram",
  "TikTok",
  "Google / ค้นหา",
  "Google Maps",
  "เพื่อนแนะนำ / ผ่านหน้าร้าน",
];

type CatForm = {
  id: string;
  name: string;
  gender: "" | "male" | "female";
  breed: string;
  breedOther: string;
  ageValue: string;
  ageUnit: "year" | "month";
  weightKg: string;
  neutered: "" | "yes" | "no";
  birthday: string;
  medical: string;
  seizureHistory: string;
  allergy: string;
  note: string;
  needsConfirm: boolean;
  /** น้องที่ยังไม่ได้บันทึก — ใช้ผูกรูปที่เลือกไว้ก่อน */
  tempKey?: string;
};

export default function ProfilePage() {
  const { ready, profile } = useLiff();
  const { config } = useConfig();
  const breeds = config.options?.catBreeds?.length ? config.options.catBreeds : BREED_OPTIONS;
  const referrals = config.options?.referralOptions?.length
    ? config.options.referralOptions
    : REFERRAL_FALLBACK;
  const { L, en } = useL();
  const referralName = (v: string) => (en ? REFERRAL_OPTIONS_EN[v] ?? v : v);
  const breedName = (b: string) => (en ? b.match(/\(([^)]+)\)\s*$/)?.[1] ?? b : b);

  const [loading, setLoading] = useState(true);
  const [found, setFound] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [referral, setReferral] = useState("");
  const [address, setAddress] = useState("");
  const [addressMapUrl, setAddressMapUrl] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [consent, setConsent] = useState(true);
  const [cats, setCats] = useState<CatForm[]>([]);
  // รูปน้องแยกโหลด/อัปทีละตัว (ไม่ผูกกับปุ่มบันทึก) — อัปแล้วขึ้นทันที
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  // รูปของน้องที่ยังไม่ได้บันทึก — โชว์ไว้ก่อน แล้วอัปให้อัตโนมัติตอนกดบันทึก
  const [pendingPhotos, setPendingPhotos] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // ป๊อปอัปสรุปให้เช็คก่อนบันทึกจริง
  const [reviewing, setReviewing] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!profile?.lineUserId) return;
    fetch(`/api/customers/self?lineUserId=${profile.lineUserId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.found) return;
        setFound(true);
        const c = d.customer;
        setName(c.name || "");
        setPhone(c.phone || "");
        setEmail(c.email || "");
        setBirthday(c.birthday || "");
        setReferral(c.referralSource || "");
        setAddress(c.address || "");
        setAddressMapUrl(c.addressMapUrl || "");
        setPostalCode(c.postalCode || "");
        setConsent(c.marketingConsent !== false);
        setCats(
          (c.cats || []).map((x: Record<string, unknown>) => {
            const breedVal = String(x.breed || "");
            const known = breeds.includes(breedVal);
            return {
              id: String(x.id),
              name: String(x.name || ""),
              gender: (x.gender as CatForm["gender"]) || "",
              breed: breedVal ? (known ? breedVal : OTHER_BREED) : "",
              breedOther: breedVal && !known ? breedVal : "",
              ageValue: x.ageValue != null ? String(x.ageValue) : "",
              ageUnit: (x.ageUnit as "year" | "month") || "year",
              weightKg: x.weightKg != null ? String(x.weightKg) : "",
              neutered: x.neutered === true ? "yes" : x.neutered === false ? "no" : "",
              birthday: String(x.birthday || ""),
              medical: String(x.medical || ""),
              seizureHistory: String(x.seizureHistory || ""),
              allergy: String(x.allergy || ""),
              note: String(x.note || ""),
              needsConfirm: Boolean(x.needsConfirm),
            };
          })
        );
      })
      .finally(() => setLoading(false));
  }, [profile?.lineUserId, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPhotos = async (lineUserId: string) => {
    const d = await fetch(`/api/customers/cat-photo?lineUserId=${encodeURIComponent(lineUserId)}`)
      .then((r) => r.json())
      .catch(() => ({ cats: [] }));
    const map: Record<string, string | null> = {};
    for (const c of (d.cats || []) as { id: string; photoDataUrl?: string | null }[]) map[c.id] = c.photoDataUrl || null;
    setPhotos(map);
  };

  useEffect(() => {
    if (profile?.lineUserId) loadPhotos(profile.lineUserId);
  }, [profile?.lineUserId, reloadKey]);

  const postPhoto = async (lineUserId: string, catId: string, photoDataUrl: string) => {
    const res = await customerFetch("/api/customers/cat-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineUserId, catId, photoDataUrl }),
    });
    if (!res.ok) throw new Error("อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้งนะคะ");
  };

  const pickPendingPhoto = async (key: string, file: File) => {
    setPhotoError("");
    try {
      const url = await toJpegDataUrl(file);
      setPendingPhotos((m) => ({ ...m, [key]: url }));
    } catch {
      setPhotoError(L("เปิดรูปนี้ไม่ได้ ลองเลือกรูปอื่นนะคะ", "Couldn't open this photo, please pick another"));
    }
  };

  const uploadPhoto = async (catId: string, file: File) => {
    if (!profile?.lineUserId) return;
    setPhotoError("");
    setUploadingId(catId);
    try {
      const photoDataUrl = await toJpegDataUrl(file);
      await postPhoto(profile.lineUserId, catId, photoDataUrl);
      await loadPhotos(profile.lineUserId);
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : L("อัปโหลดรูปไม่สำเร็จ", "Photo upload failed"));
    } finally {
      setUploadingId(null);
    }
  };

  const updateCat = (idx: number, patch: Partial<CatForm>) =>
    setCats((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));

  const addNewCat = () =>
    setCats((prev) => [
      ...prev,
      {
        id: "",
        name: "",
        gender: "",
        breed: "",
        breedOther: "",
        ageValue: "",
        ageUnit: "year",
        weightKg: "",
        neutered: "",
        birthday: "",
        medical: "",
        seizureHistory: "",
        allergy: "",
        note: "",
        needsConfirm: false,
        tempKey: `new-${Date.now()}`,
      },
    ]);

  const removeNewCat = (idx: number) => {
    const key = cats[idx]?.tempKey;
    if (key) setPendingPhotos((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== key)));
    setCats((prev) => prev.filter((_, i) => i !== idx));
  };

  /** สรุปข้อมูลทั้งหมดก่อนบันทึก */
  const reviewSections = (): ReviewSection[] => [
    {
      title: L("ข้อมูลผู้ปกครอง", "Owner details"),
      icon: "user",
      rows: [
        { label: L("ชื่อผู้ปกครอง", "Owner name"), value: name },
        { label: L("เบอร์โทร", "Phone"), value: phone },
        { label: L("อีเมล", "Email"), value: email },
        { label: L("วันเกิด", "Birthday"), value: reviewDate(birthday, en ? "en" : "th") },
        { label: L("ที่อยู่บ้าน", "Home address"), value: address },
        { label: L("ลิงก์แผนที่", "Map link"), value: addressMapUrl ? L("แนบแล้ว", "Added") : "" },
        { label: L("รหัสไปรษณีย์", "Postal code"), value: postalCode },
      ],
    },
    ...cats
      .filter((c) => c.name.trim())
      .map((c) => ({
        title: en ? (c.id ? c.name.trim() : `${c.name.trim()} (new)`) : c.id ? `น้อง${c.name.trim()}` : `น้อง${c.name.trim()} (เพิ่มใหม่)`,
        icon: "paw",
        rows: [
          { label: L("เพศ", "Sex"), value: c.gender === "male" ? L("♂ ผู้", "♂ Male") : c.gender === "female" ? L("♀ เมีย", "♀ Female") : "" },
          { label: L("สายพันธุ์", "Breed"), value: c.breed === OTHER_BREED ? c.breedOther : c.breed },
          { label: L("ทำหมัน", "Neutered / spayed"), value: c.neutered === "yes" ? L("ทำหมันแล้ว", "Yes") : c.neutered === "no" ? L("ยังไม่ทำ", "Not yet") : "" },
          {
            label: L("อายุ", "Age"),
            value: [
              c.ageValue ? `${c.ageValue} ${c.ageUnit === "month" ? L("เดือน", "months") : L("ปี", "years")}` : "",
              c.birthday ? `${L("เกิด", "Born")} ${reviewDate(c.birthday, en ? "en" : "th")}` : "",
            ]
              .filter(Boolean)
              .join(" · "),
          },
          { label: L("น้ำหนัก", "Weight"), value: c.weightKg ? `${c.weightKg} ${L("กก.", "kg")}` : "" },
          { label: L("โรคประจำตัว / เรื่องที่ช่างต้องรู้", "Health conditions / things our staff should know"), value: [c.medical, c.note].map((x) => x.trim()).filter(Boolean).join("\n") },
          { label: L("ประวัติการชัก/ช็อค", "History of seizures / collapse"), value: c.seizureHistory },
          { label: L("ประวัติการแพ้", "Allergies"), value: c.allergy },
        ],
      })),
    {
      title: L("อื่น ๆ", "Other"),
      icon: "sparkle",
      rows: [
        { label: L("รู้จักเราจากทางไหน", "How did you hear about us?"), value: referralName(referral) },
        { label: L("รับข่าวสาร/โปรโมชั่น", "News & promotions"), value: consent ? L("ยินยอม", "Yes") : L("ไม่ยินยอม", "No") },
      ],
    },
  ];

  const save = async () => {
    if (!profile?.lineUserId || !name.trim()) return;
    setSaving(true);
    setSaved(false);
    setSaveError("");
    try {
      const res = await customerFetch("/api/customers/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lineUserId: profile.lineUserId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          birthday,
          referralSource: referral,
          address,
          addressMapUrl,
          postalCode,
          marketingConsent: consent,
          cats: cats.map((c) => ({
            id: c.id,
            name: c.name,
            gender: c.gender || undefined,
            breed:
              (c.breed === OTHER_BREED ? c.breedOther.trim() : c.breed) || undefined,
            ageValue: c.ageValue,
            ageUnit: c.ageUnit,
            weightKg: c.weightKg,
            neutered: c.neutered ? c.neutered === "yes" : null,
            birthday: c.birthday || undefined,
            medical: c.medical || undefined,
            seizureHistory: c.seizureHistory.trim(),
            allergy: c.allergy.trim(),
            note: c.note || undefined,
          })),
        }),
      });
      if (res.ok) {
        // อัปรูปที่เลือกไว้ให้น้องที่เพิ่งได้ id จริง
        const d = await res.json().catch(() => ({}));
        const failed: string[] = [];
        for (const { index, id } of (d.created || []) as { index: number; id: string }[]) {
          const key = cats[index]?.tempKey;
          const url = key ? pendingPhotos[key] : undefined;
          if (!url) continue;
          await postPhoto(profile.lineUserId, id, url).catch(() => failed.push(cats[index].name));
        }
        setPendingPhotos({});
        if (failed.length) setPhotoError(L(`บันทึกข้อมูลแล้ว แต่อัปรูป ${failed.join(", ")} ไม่สำเร็จ ลองเพิ่มรูปใหม่อีกครั้งนะคะ`, `Saved, but the photo for ${failed.join(", ")} didn't upload. Please add it again.`));
        setSaved(true);
        // โหลดใหม่ให้น้องที่เพิ่งเพิ่มได้ id จริง — ไม่งั้นกดบันทึกซ้ำจะสร้างซ้ำ
        setReloadKey((k) => k + 1);
        setTimeout(() => setSaved(false), 2500);
        setReviewing(false);
        savedPopup(L("บันทึกข้อมูลสำเร็จ", "Saved"));
      } else {
        const d = await res.json().catch(() => ({}));
        setSaveError(d.error || L("บันทึกไม่สำเร็จ — ลองใหม่อีกครั้งนะคะ", "Could not save, please try again"));
      }
    } catch {
      setSaveError(L("เชื่อมต่อไม่สำเร็จ — เช็คสัญญาณอินเทอร์เน็ตแล้วลองใหม่นะคะ", "Couldn't connect. Check your internet and try again."));
    } finally {
      setSaving(false);
    }
  };

  const field = "min-h-[44px] w-full rounded-catcha-sm border border-catcha-line bg-paper px-3 py-2.5 text-sm";
  const sub = "min-h-[44px] w-full rounded-xl border border-catcha-line bg-paper px-3 py-2 text-sm";
  const chip = (on: boolean) =>
    `min-h-[44px] rounded-full px-4 text-xs font-bold transition ${
      on ? "bg-latte/40 text-catcha-chocolate ring-1 ring-latte-deep" : "bg-paper text-brown-soft"
    }`;

  return (
    <div className="px-4 pb-6 pt-5">
      <PageHeader
        eyebrow="Profile"
        title={L("แก้ไขข้อมูลของฉัน", "Edit my details")}
        back="/app"
        backLabel={L("กลับหน้าแรก", "Back to home")}
        showLang={false}
      />

      {!ready || loading ? (
        <LoadingScreen />
      ) : !found ? (
        <>
          <div className="rounded-catcha border border-catcha-line bg-card shadow-catcha-sm">
            <EmptyState icon="user" title={L("ยังไม่มีข้อมูลของคุณในระบบ", "We don't have your details yet")} />
          </div>
          <Link href="/app/register" className={`mt-5 ${BTN_PRIMARY}`}>
            <Icon name="edit" size={18} />
            {L("ลงทะเบียนก่อนค่ะ", "Sign up first")}
          </Link>
        </>
      ) : (
        <>
          {/* ── ผู้ปกครอง ── */}
          <SectionLabel>{L("Owner · ผู้ปกครอง", "Owner")}</SectionLabel>
          <div className="space-y-3 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
            <label className="block text-xs font-bold text-brown-soft">
              {L("ชื่อผู้ปกครอง", "Owner name")}
              <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1 font-bold text-brown`} />
            </label>
            <label className="block text-xs font-bold text-brown-soft">
              {L("เบอร์โทร", "Phone")}
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="08x-xxx-xxxx" className={`${field} mt-1`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold text-brown-soft">
                {L("อีเมล", "Email")}
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@email.com" className={`${field} mt-1`} />
              </label>
              <label className="block text-xs font-bold text-brown-soft">
                {L("วันเกิด", "Birthday")}
                <input value={birthday} onChange={(e) => setBirthday(e.target.value)} type="date" className={`${field} mt-1`} />
              </label>
            </div>
            <label className="block text-xs font-bold text-brown-soft">
              {L("ที่อยู่บ้าน", "Home address")}{" "}
              <span className="font-normal text-brown-faint">{L("(ไว้ใช้บริการรับ-ส่ง)", "(for pick-up & drop-off)")}</span>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={L("เช่น บ้านเลขที่ ซอย ถนน แขวง/ตำบล เขต/อำเภอ", "e.g. house no., soi, road, sub-district, district")}
                rows={2}
                className={`${field} mt-1`}
              />
            </label>
            <label className="block text-xs font-bold text-brown-soft">
              {L("ลิงก์ Google Maps", "Google Maps link")}
              <input
                value={addressMapUrl}
                onChange={(e) => setAddressMapUrl(e.target.value)}
                placeholder={L("เปิด Maps แล้วกดแชร์ลิงก์มาวางตรงนี้", "Open Maps, tap Share and paste the link here")}
                className={`${field} mt-1`}
              />
            </label>
            <label className="block text-xs font-bold text-brown-soft">
              {L("รหัสไปรษณีย์", "Postal code")}
              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
                inputMode="numeric"
                placeholder={L("เช่น 10260", "e.g. 10260")}
                className={`${field} mt-1`}
              />
            </label>
          </div>

          {/* ── น้องแมว ── */}
          <div className="mt-6 space-y-3">
            <SectionLabel>{L("My cats · น้องแมวของฉัน", "My cats")}</SectionLabel>
            {cats.map((cat, idx) => (
              <div key={cat.id || `new-${idx}`} className="space-y-2.5 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
                {cat.id ? (
                  <CatPhoto
                    src={photos[cat.id]}
                    name={cat.name || L("น้องแมว", "Cat")}
                    size={0}
                    onPick={(f) => uploadPhoto(cat.id, f)}
                    uploading={uploadingId === cat.id}
                  />
                ) : cat.tempKey ? (
                  <CatPhoto
                    src={pendingPhotos[cat.tempKey]}
                    name={cat.name || L("น้องแมว", "Cat")}
                    size={0}
                    onPick={(f) => pickPendingPhoto(cat.tempKey!, f)}
                  />
                ) : null}
                {cat.needsConfirm && (
                  <p className="flex gap-2 rounded-catcha-sm bg-honey/20 px-3 py-2 text-[11px] font-bold text-catcha-chocolate">
                    <Icon name="alert" size={15} className="mt-px" />
                    <span>
                      {L(
                        "ตอนนี้เป็นข้อมูลที่ทางร้านกรอกแทนไว้ — ช่วยตรวจสอบ/แก้ไขให้ล่าสุด แล้วกดบันทึกด้านล่างด้วยนะคะ 🙏",
                        "The shop filled this in for you. Please check and update it, then tap save below 🙏"
                      )}
                    </span>
                  </p>
                )}
                <label className="block text-xs font-bold text-brown-soft">
                  {L("ชื่อน้อง", "Cat's name")}
                  <input value={cat.name} onChange={(e) => updateCat(idx, { name: e.target.value })} className={`${sub} mt-1 font-bold text-brown`} />
                </label>
                <div className="flex gap-1 rounded-full bg-paper p-1">
                  {([["male", L("♂ ผู้", "♂ Male")], ["female", L("♀ เมีย", "♀ Female")]] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={cat.gender === v}
                      onClick={() => updateCat(idx, { gender: cat.gender === v ? "" : v })}
                      className={`min-h-[40px] flex-1 rounded-full text-sm font-bold transition ${cat.gender === v ? "bg-card text-catcha-chocolate shadow-catcha-sm" : "text-brown-soft"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <select
                  value={cat.breed}
                  onChange={(e) => updateCat(idx, { breed: e.target.value })}
                  className={`${sub} ${cat.breed ? "text-brown" : "text-brown-faint"}`}
                >
                  <option value="">{L("เลือกสายพันธุ์…", "Choose a breed…")}</option>
                  {breeds.map((b) => (
                    <option key={b} value={b} className="text-brown">{breedName(b)}</option>
                  ))}
                  <option value={OTHER_BREED} className="text-brown">{L(OTHER_BREED, "Other")}</option>
                </select>
                {cat.breed === OTHER_BREED && (
                  <input value={cat.breedOther} onChange={(e) => updateCat(idx, { breedOther: e.target.value })} placeholder={L("ระบุสายพันธุ์", "Type the breed")} className={sub} />
                )}
                <div className="flex gap-1 rounded-full bg-paper p-1">
                  {([["yes", L("ทำหมันแล้ว", "Neutered / spayed")], ["no", L("ยังไม่ทำ", "Not yet")]] as const).map(([v, l]) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={cat.neutered === v}
                      onClick={() => updateCat(idx, { neutered: cat.neutered === v ? "" : v })}
                      className={`min-h-[40px] flex-1 rounded-full text-sm font-bold transition ${cat.neutered === v ? "bg-card text-catcha-chocolate shadow-catcha-sm" : "text-brown-soft"}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <NumInput
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={cat.ageValue}
                    onChange={(e) => updateCat(idx, { ageValue: e.target.value })}
                    placeholder={L("อายุ", "Age")}
                    className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-catcha-line bg-paper px-3 py-2 text-sm"
                  />
                  <select
                    value={cat.ageUnit}
                    onChange={(e) => updateCat(idx, { ageUnit: e.target.value as "year" | "month" })}
                    className="min-h-[44px] w-24 shrink-0 rounded-xl border border-catcha-line bg-paper px-3 py-2 text-sm"
                  >
                    <option value="year">{L("ปี", "years")}</option>
                    <option value="month">{L("เดือน", "months")}</option>
                  </select>
                </div>
                <label className="block text-[11px] font-bold text-brown-soft">
                  {L("น้ำหนัก", "Weight")} <span className="font-normal text-brown-faint">{L("(กก. · ไม่บังคับ)", "(kg · optional)")}</span>
                  <NumInput
                    type="number"
                    min="0"
                    step="0.1"
                    inputMode="decimal"
                    value={cat.weightKg}
                    onChange={(e) => updateCat(idx, { weightKg: e.target.value })}
                    placeholder={L("เช่น 4.5", "e.g. 4.5")}
                    className={`${sub} mt-0.5`}
                  />
                </label>
                <div className="text-[11px] font-bold text-brown-soft">
                  {L("วันเกิดน้อง", "Birthday")} <span className="font-normal text-brown-faint">{L("(ถ้าทราบ)", "(if known)")}</span>
                  <div className="mt-0.5">
                    <BirthdayPicker
                      value={cat.birthday}
                      onChange={(iso) => updateCat(idx, { birthday: iso })}
                      yearsBack={25}
                      allowUnknown
                      locale={en ? "en" : "th"}
                    />
                  </div>
                </div>
                <StaffNoteTagPicker
                  label={L("โรคประจำตัว / เรื่องที่ช่างต้องรู้", "Health conditions / things our staff should know")}
                  locale={en ? "en" : "th"}
                  medicalValue={cat.medical}
                  noteValue={cat.note}
                  onChange={(medical, note) => updateCat(idx, { medical, note })}
                />
                <label className="block text-[11px] font-bold text-brown-soft">
                  {L("ประวัติการชัก/ช็อค", "History of seizures / collapse")} <span className="font-normal text-brown-faint">{L("(ไม่มีเว้นว่างได้)", "(leave blank if none)")}</span>
                  <input value={cat.seizureHistory} onChange={(e) => updateCat(idx, { seizureHistory: e.target.value })} placeholder={L("เช่น ไม่เคย · หรือ เคยชักตอนตกใจ", "e.g. never · or had a seizure when startled")} className={`${sub} mt-0.5 font-normal text-brown`} />
                </label>
                <label className="block text-[11px] font-bold text-brown-soft">
                  {L("ประวัติการแพ้", "Allergies")} <span className="font-normal text-brown-faint">{L("(อาหาร / ยา / แชมพู)", "(food / medicine / shampoo)")}</span>
                  <input value={cat.allergy} onChange={(e) => updateCat(idx, { allergy: e.target.value })} placeholder={L("เช่น ไม่มี · หรือ แพ้ไก่ แพ้แชมพูบางยี่ห้อ", "e.g. none · or chicken, certain shampoos")} className={`${sub} mt-0.5 font-normal text-brown`} />
                </label>
                {!cat.id && (
                  <button
                    type="button"
                    onClick={() => removeNewCat(idx)}
                    className="-ml-1 flex min-h-[44px] items-center gap-1.5 px-1 text-xs font-bold text-brown-soft"
                  >
                    <Icon name="trash" size={15} />
                    {L("ลบน้องแมวตัวนี้", "Remove this cat")}
                  </button>
                )}
              </div>
            ))}
            {photoError && (
              <p className="flex items-center gap-2 text-xs font-bold text-wait">
                <Icon name="alert" size={15} />
                {photoError}
              </p>
            )}
            {/* ปุ่มเพิ่มน้องต้องเห็นชัด — ลูกค้าหลายบ้านมีแมวมากกว่าหนึ่งตัว */}
            <button
              type="button"
              onClick={addNewCat}
              className="flex min-h-[60px] w-full items-center gap-3 rounded-catcha border-2 border-honey-deep bg-honey/45 px-4 text-left text-catcha-chocolate shadow-catcha-sm transition active:scale-[.98]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-catcha-chocolate text-card">
                <Icon name="plus" size={20} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold">{L("เพิ่มน้องแมวอีกตัว", "Add another cat")}</span>
                <span className="block text-[11px] text-catcha-chocolate/70">{L("มีหลายตัว เพิ่มได้ทุกตัวเลยค่ะ", "Have more cats? Add them all")}</span>
              </span>
              <Icon name="paw" size={22} className="text-catcha-chocolate/60" />
            </button>
            <p className="text-[11px] text-brown-faint">
              {L("กรอกข้อมูลน้องใหม่แล้วกด “บันทึก” ด้านล่างเพื่อเพิ่มเข้าระบบ 🧡", "Fill in the new cat, then tap Save below to add them 🧡")}
            </p>
          </div>

          {/* ── รู้จักเราจากทางไหน ── */}
          <div className="mt-6">
            <SectionLabel>{L("Referral · รู้จักเราจากทางไหน?", "How did you hear about us?")}</SectionLabel>
            <div className="flex flex-wrap gap-2 rounded-catcha border border-catcha-line bg-card p-3 shadow-catcha-sm">
              {referrals.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  aria-pressed={referral === opt}
                  onClick={() => setReferral((p) => (p === opt ? "" : opt))}
                  className={chip(referral === opt)}
                >
                  {referralName(opt)}
                </button>
              ))}
            </div>
          </div>

          {/* ── ยินยอมรับข่าวสาร ── */}
          <label className="mt-4 flex min-h-[48px] cursor-pointer items-center gap-3 rounded-catcha border border-catcha-line bg-card p-4 shadow-catcha-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="h-5 w-5 flex-none accent-[#4A7348]" />
            <span className="text-xs text-brown">{L("ยินยอมให้ส่งข่าวสาร โปรโมชั่น และสิทธิพิเศษ", "Send me news, promotions and special offers")}</span>
          </label>

          <button
            type="button"
            onClick={() => setReviewing(true)}
            disabled={saving || !name.trim()}
            className={`mt-6 ${BTN_PRIMARY}`}
          >
            {saving ? L("กำลังบันทึก…", "Saving…") : L("บันทึกข้อมูล", "Save")}
          </button>
          <ReviewSheet
            open={reviewing}
            sections={reviewing ? reviewSections() : []}
            saving={saving}
            error={saveError}
            confirmLabel={L("ยืนยัน บันทึกข้อมูล", "Confirm and save")}
            onEdit={() => {
              setReviewing(false);
              setSaveError("");
            }}
            onConfirm={save}
          />
          {saved && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-extrabold text-ok">
              <Icon name="check" size={16} strokeWidth={2.4} />
              {L("บันทึกเรียบร้อยแล้วค่ะ 🧡", "Saved 🧡")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
